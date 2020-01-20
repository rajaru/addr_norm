const fs = require('fs');
const path = require('path');
const request = require('request');
const unzip = require('unzipper');
const utils= require('./utils');

const tmp = "z:\\tmp\\out";
const countries = [
    'US', 'IN', 'CA', 'GB_full.csv', 'AU', 'BR', 'SG', 'FR', 'NO', 'DE', 'NL_full.csv', 'JP', 'MX', 'DK', 'ES'
];

class update {

    async aget(url, headers, ignoreCertErrs){
        return new Promise(function(resolve, reject){
            var options = {url: url, method: 'GET', encoding: null};
            if(ignoreCertErrs)options.rejectUnauthorized = false;
            if(headers)options.headers = headers;
            request.get(options, function(err, resp, body){
                if( err )return reject(err);
                else if(resp && resp.statusCode!=200 && resp.statusCode!=204)return reject(resp.statusCode+' '+body);
                else return resolve(body);
            });
        });
    }
    async unzip(zfile, folder){
        return new Promise( (resolve, reject)=>{
            fs.createReadStream(zfile).pipe(unzip.Extract({ path: folder })).on('close', async function(){
                resolve(zfile);
            }).on('error', function(err){
                reject(err);
            });
        });
    }

    _add_zipcode(country, statecode, zip){
        if( !country || !zip )return;
        var data = country+','+(statecode||'');
        if( !this.zip ){
            var fname = path.join(__dirname, 'zip.json');
            if( fs.existsSync(fname) )this.zip = JSON.parse( fs.readFileSync(fname, 'utf8') );
            else this.zip = {};
        }
        if( !this.zip.hasOwnProperty(zip) )
            this.zip[zip] = data;
        else{
            if( !(this.zip[zip] instanceof Array) ){
                if( this.zip[zip] != data ){
                    this.zip[zip] = [this.zip[zip], data];
                }
                else{
                    // already present, ignore
                }
            }
            else{
                if( this.zip[zip].indexOf(data)<0 )
                    this.zip[zip].push(data);
            }
        }
    }

    _add_city_details(rec){
        for(var key in rec )rec[key] = (rec[key]||'').toLowerCase();
        if( rec.city && rec.city != 'street' && rec.city != 'avenue' ){ // seriously?!!
            var states = this.country.cities[rec.city];
            var state_code = rec.state_code || 1;

            if( states ){
                if( state_code == states ){
                    // same as what is already there
                }
                else if( states instanceof Array ){
                    if( states.indexOf(state_code)<0 )states.push(state_code);
                    //else its already there in the array
                }
                else
                    this.country.cities[rec.city] = [states, state_code];
            }
            else
                this.country.cities[rec.city] = state_code;
        }
        
        if( rec.state )this.country.states[rec.state] = rec.state_code;
        if( rec.region)this.country.regions[rec.region]=1;
        if( rec.place )this.country.places[rec.place] = 1;
        if( rec.state_code && !Number.isInteger(rec.state_code) )
            this.country.statecodes[rec.state_code] = rec.state;

    }

    async _parse_cities_geonames(fname){
        var columns = ['country', 'zip', 'city', 'state', 'state_code', 'region', false, 'place', false, false, false, false];
        var options = {delimiter: '\t', quote: null, columns: columns, raw: false, info: false};
        try{
            var cities = await utils.csv_to_array(fname, options);
            
            for(var city of cities ){
                //this._add_city_details( city.city, city.state, city.region, city.place);
                this._add_city_details( city );
                this._add_zipcode(city.country, city.state_code, city.zip);
            }
        }catch(e){
            console.log(e);
        }
        
        // console.log(cities);
    }

    async _update_uk_zipcodes(folder){
        var cityFolder = path.join(tmp, 'cities');
        if( !fs.existsSync(cityFolder) )fs.mkdirSync( cityFolder );
        var zipFile = path.join(cityFolder, 'ukzip.zip');
        var url = "https://www.doogal.co.uk/files/postcodes.zip";
        try{
            if( !fs.existsSync(zipFile) ){
                console.log('downloading...', url);
                fs.writeFileSync(zipFile, await this.aget(url));
            }
            var txtFile = "g:\\temp\\postcodes.csv";
            if( !fs.existsSync(txtFile) )
                await this.unzip(zipFile, "g:\\temp");
            
            
            if( !fs.existsSync(txtFile) ){
                console.log('Could not locate ', txtFile);
                return;
            };

            var columns = ['zip', 'inuse', null,null,null,null,null,null,'district',null,
                null,null,'state',null,null,null,null,null,null,null,null,null,null,null,null,'region',
                null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null, null, null, null];
            var options = {delimiter: ',', quote: '"', columns: columns, raw: false, info: false, from: 1};
            try{
                var cities = await utils.csv_to_array(txtFile, options);
                var ukzips = {};
                var statecodes = {"england":"eng","l93000001":"","m83000003":"","northern ireland":"nir","scotland":"sct","wales":"wls"};

                for(var city of cities ){
                    ukzips[city.zip.toLowerCase()] = 'uk,'+(statecodes[city.state.toLowerCase()]||'');
                }
                var jsfile = path.join(__dirname, 'ukzip.json');
                fs.writeFileSync(jsfile, JSON.stringify(ukzips), null, 2);
            }catch(e){
                console.log(e);
            }
        }catch(e){
            console.log('exception:', e);
            return null;
        }

    }


    async _update_country_geonames(c, folder){
        var cityFolder = path.join(tmp, 'cities');
        if( !fs.existsSync(cityFolder) )fs.mkdirSync( cityFolder );

        var zipFile = path.join(cityFolder, c+'.zip');
        var url = "http://download.geonames.org/export/zip/"+c+'.zip';
        
        try{
            this.country = {
                states: {},
                cities: {},
                regions:{},
                places: {},
                statecodes: {}
            };
            if( !fs.existsSync(zipFile) ){
                console.log('downloading...', url);
                fs.writeFileSync(zipFile, await this.aget(url));
            }
            await this.unzip(zipFile, cityFolder);

            var txtFile = path.join(cityFolder, c+'.txt');
            if( !fs.existsSync(txtFile) ){
                txtFile = path.join(cityFolder, c.replace('.csv', '')+'.txt');
                if( !fs.existsSync(txtFile) ){
                    console.log('Could not locate ', txtFile);
                    return;
                }
            }
            await this._parse_cities_geonames(txtFile);
            
            if( folder ){
                var jsfile = path.join(folder, c.replace('_full.csv', '').toLowerCase()+'.json');
                fs.writeFileSync(jsfile, JSON.stringify(this.country), null, 2);
                if( this.zip ){
                    jsfile = path.join(folder, 'zip.json');
                    fs.writeFileSync(jsfile, JSON.stringify(this.zip), null, 2);
                }
            }
            // utils.rmFile(zipFile);
        }catch(e){
            console.log('exception:', e);
            return null;
        }
    }

    async cities(){
        var fname = path.join(__dirname, 'country-codes.csv');
        var records = await utils.csv_to_json(fname);
        var clist = records.map(x=>({
            name: x.official_name_en,
            alpha2: x["ISO3166-1-Alpha-2"],
            alpha3: x["ISO3166-1-Alpha-3"],
        }));
        fname = path.join(__dirname, 'country-codes.json');
        fs.writeFileSync(fname, JSON.stringify(clist));

        for(var c of countries )
            await this._update_country_geonames(c, __dirname);

        // await this._update_uk_zipcodes();
    }

    async street_abbreviations(){
        var fname = path.join(__dirname, 'street_abbrev.csv');
        var columns = ['alt1', 'alt2', 'alt3'];
        var options = {delimiter: ',', quote: null, columns: columns, 
            raw: false, info: false, headers: false};
        try{
            var abbrv = await utils.csv_to_array(fname, options);
            var prev = null;
            for(var ab of abbrv ){
                if( !ab.alt1 )ab.alt1 = prev.alt1;
                if( !ab.alt3 )ab.alt3 = prev.alt3;
                ab.alt1 = ab.alt1.trim().toLowerCase();
                ab.alt2 = ab.alt2.trim().toLowerCase();
                ab.alt3 = ab.alt3.trim().toLowerCase();
                prev = ab;
            }

            var amap = {};
            for(var ab of abbrv ){
                amap[ ab.alt2 ] = ab.alt1;
                amap[ ab.alt3 ] = ab.alt1;
            }
            //console.log(amap);
            fname = path.join(__dirname, 'street_abbrev.json');
            fs.writeFileSync(fname, JSON.stringify(amap));
        }catch(e){
            console.log(e);
        }

    }
}

module.exports = new update();