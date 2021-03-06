const fs = require('fs');
const path = require('path');
const request = require('request');
const unzip = require('unzipper');
const utils= require('./utils');
const diacrt = require('diacritics');
diacrt.diacriticsMap['ä'] = 'ae';
diacrt.diacriticsMap['ö'] = 'oe';
diacrt.diacriticsMap['ü'] = 'ue';


const tmp = "g:\\tmp\\out";
const countries = [
    'US', 'IN', 'CA', 'GB_full.csv', 'AU', 
    'BR',   // Brazil
    'SG',   // Singaport
    'FR',   // France
    'NO',   // Norway
    'DE',   // Germany
    'NL_full.csv', 'JP', 
    'MX',   // Mexico
    'DK',   // Denmark
    'ES',   // Spain
    'MY',   // Malaysia
    'CH',   // Switzerland
    'SE',   // Sweden
    // 'TW',   // Taiwan,
    'AT',   // Austria,
    'AR',   // Argentina,
    // 'HK',   // Hongkong - not available
    'FI',   // Finland,
    'IE',   // Ireland
    'IT',   // Italy
    'BE',   // Belgium
    'BM',   // Bermuda
    'PT',   // Portugal
    'ZA',   // South africa,
    'LU',   // Luxemberg
    'HU',   // Hungary
    'PL',   // Poland
    'RU',   // Russia,
    'TH',   // Thanilad
    'LI',   // Liechtenstein
    'TR',   // Turkey,
    'KR',   // South Korea
    'NZ',   // New zealand
    'ID',   // Indonasia
    'IL',   // Israel
    'TN',   // Tunisia
];
// const countries = ['AT'];





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

    fix_city_name(city, country){
        var remexp = [/ am main/,
            /an der havel/,
            /am Rhein/,
            /an der Lahn/,
            // /de ballesteros/,
            // /de ballesteros/,
            /de morcin/,
            /(\(.*\))/,
            /^wein, /,
            /^region /,
            / region$/
        ];
        for(var r of remexp )city = city.replace(r, '');
        city = city.replace(/\s+/g, ' ').trim();

        if( !this.english ){
            this.english = JSON.parse( fs.readFileSync(path.join(__dirname, 'english.json'), 'utf-8') );
        }
        if( this.english[city] )city = this.english[city];

        city = diacrt.remove(city);

        if( country.toLowerCase() == 'jp '){
            var suffix = [/ ken$/, / to$/, / fu$/, / do$/, / gun$/, / shi$/, / ku$/, / machi$/, / cho$/, / mura$/, / son$/];
            for(var suf of suffix ){
                city = city.replace(suf, '');
            }
        }

        return city;
    }

    fix_state_name(state, country){
        if( !state )return '';
        var remexp = [
            /(\(.*\))/,
            /^region /,
            / region$/
        ];
        for(var r of remexp )state = state.replace(r, '');
        state = state.replace(/\s+/g, ' ').trim();

        if( !this.english ){
            this.english = JSON.parse( fs.readFileSync(path.join(__dirname, 'english.json'), 'utf-8') );
        }
        if( this.english[state] )return this.english[state];
        return state;
    }

    _add_zipcode(country, statecode, zip, city){
        if( !country || !zip )return;
        zip = zip.trim().replace(' ', '-').replace('-000', '');
        //var cityname = this.fix_city_name(city, country);
        var city = this.fix_city_name(city, country);

        statecode = this.fix_state_name(statecode);
        if( !this.zip )this._read_zip_json();

        if( !this.zip[zip] )this.zip[zip] = {};

        if( !this.zip[zip].hasOwnProperty(country) )this.zip[zip][country] = {};

        if( this.zip[zip][country][city] && this.zip[zip][country][city] != statecode ){
            if( !this.zip.conflicts[zip] )this.zip.conflicts[zip] = [];
            var data = country+','+statecode+','+city;
            if( this.zip.conflicts[zip].indexOf(data)<0 )this.zip.conflicts[zip].push(data);
            this.conflicts++;
        }


        if( !this.zip[zip][country][city] )this.zip[zip][country][city] = statecode;
        // if( !this.zip[zip][country][cityname] )this.zip[zip][country][cityname] = statecode;
    }

    _add_city_details(rec){
        for(var key in rec )rec[key] = (rec[key]||'').toLowerCase();
        if( rec.city && rec.city != 'street' && rec.city != 'avenue' ){ // seriously?!!
            var cityname = this.fix_city_name(rec.city, rec.country);
            var statename= this.fix_state_name(rec.state, rec.country);
            var states = this.country.cities[rec.city];
            var state_code = rec.state_code || rec.state || 1;

            if( !isNaN(rec.state_code) ){
                state_code = rec.state || '';
            }

            if( states ){
                if( state_code == states ){
                    // same as what is already there
                }
                else if( states instanceof Array ){
                    if( states.indexOf(state_code)<0 )states.push(state_code);
                    //else its already there in the array
                }
                else{
                    this.country.cities[rec.city] = [states, state_code];
                    this.country.cities[cityname] = [states, state_code];
                }
            }
            else{
                this.country.cities[rec.city] = state_code;
                this.country.cities[cityname] = state_code;
            }

            /*
            if( rec.zip ){
                var citystate = cityname+','+state_code;
                if( !this.country.zips[rec.zip] )
                    this.country.zips[rec.zip] = citystate;
                else if( this.country.zips[rec.zip] instanceof Array ){
                    if( this.country.zips[rec.zip].indexOf(citystate) < 0 )this.country.zips[rec.zip].push(citystate);
                }
                else if( this.country.zips[rec.zip] == citystate ){

                }
                else{
                    this.country.zips[rec.zip] = [citystate, this.country.zips[rec.zip]];
                }
                
            }*/
        }
        
        // console.log('state:', statename, rec.state);
        if( rec.state )this.country.states[rec.state] = state_code;
        if( statename )this.country.states[statename] = state_code;
        //if( rec.region)this.country.regions[rec.region]=1;
        //if( rec.place )this.country.places[rec.place] = 1;
        
        if( rec.state && state_code && !Number.isInteger(state_code) ){
            this.country.statecodes[state_code] = statename || rec.state;
        }

    }

    async _parse_cities_geonames(fname, c){
        var columns = ['country', 'zip', 'city', 'state', 'state_code', 'region', false, 'place', false, false, false, false];
        if( c == 'JP')
            columns = ['country', 'zip', 'region', 'state', 'state_code', 'city', 'ward', 'place', false, false, false, false];
            
        var options = {delimiter: '\t', quote: null, columns: columns, raw: false, info: false};
        try{
            var cities = await utils.csv_to_array(fname, options);
            
            for(var city of cities ){
                if( city.zip && city.zip.indexOf(' CEDEX')>0 )
                    city.zip = city.zip.substr(0, city.zip.indexOf(' CEDEX')).trim();
                this._add_city_details( city );
                this._add_zipcode(city.country, city.state_code, city.zip, city.city);
            }
        }catch(e){
            console.log(e);
        }
        
        // console.log(cities);
    }


    _fix_state_suffixes(jpjson, recs){
        var states = recs.reduce((a,x)=>{a[x.state] = x.state; return a;}, {});
        var statecodes = {...states};
        var cities = {};
        for(var rec of recs ){
            states[rec.state+' ken'] = rec.state;
            states[rec.state+' to'] = rec.state;
            states[rec.state+' fu'] = rec.state;
            states[rec.state+' do'] = rec.state;
        }
        for(var city in jpjson.cities){
            var cstates = [];
            if( jpjson.cities[city] instanceof Array ){
                for(var stcode of jpjson.cities[city] ){
                    var st = jpjson.statecodes[stcode];
                    if( st && states[st] )cstates.push(states[st]);
                }
                if( cstates.length == 0 )cstates = null;
            }
            else{
                var stcode = jpjson.cities[city];
                var st = jpjson.statecodes[stcode];
                if( st && states[st] )cstates = states[st];
            }
            if( cstates )cities[city] = cstates;
        }

        for(var rec of recs ){
            if( !cities.hasOwnProperty(rec.city) )cities[rec.city] = rec.state;
            else if( cities[rec.city] instanceof Array ){
                if( cities[rec.city].indexOf(rec.state)<0 )cities[rec.city].push(rec.state);
            }
            else if( cities[rec.city] != rec.state )cities[rec.city] = rec.state;
        }

        jpjson.states = states;
        jpjson.cities = cities;
        jpjson.statecodes = statecodes;
    }


    async _update_br_zipcodes(){
        var cityFolder = path.join(tmp, 'cities');
        if( !fs.existsSync(cityFolder) )fs.mkdirSync( cityFolder );
        var zipFile = path.join(cityFolder, 'brzip.zip');
        var url = "http://cep.la/CEP-dados-2018-UTF8.zip";
        try{
            if( !fs.existsSync(zipFile) ){
                console.log('downloading...', url);
                fs.writeFileSync(zipFile, await this.aget(url));
            }
            var txtFile = path.join(tmp, 'ceps.txt');
            if( !fs.existsSync(txtFile) )
                await this.unzip(zipFile, tmp);
            
            
            if( !fs.existsSync(txtFile) ){
                console.log('Could not locate ', txtFile);
                return;
            };

            var columns = ['zip', 'state', 'city','addr', 'addr2'];
            var options = {delimiter: '\t', quote: '"', columns: columns, raw: false, info: false, relax_column_count: true};
            try{
                var cities = await utils.csv_to_array(txtFile, options);
                // var brzips = {};
                for(var city of cities ){
                    var parts = city.state.toLowerCase().split('/');
                    var cityname = city.city.toLowerCase();
                    this._add_city_details( {city: cityname, state: parts[0], state_code: parts.length>1?parts[1]:'', country: 'br', zip: city.zip.toLowerCase()} );
                    this._add_zipcode('br', parts.length>1?parts[1]:'', city.zip.toLowerCase(), cityname);

                    if( !city.addr2 && city.zip.endsWith('000') ){
                        var pzip = city.zip.substr(0, city.zip.length-3);
                        this._add_zipcode('br', parts.length>1?parts[1]:'', pzip.toLowerCase(), cityname);
                    }
                }
            }catch(e){
                console.log(e);
            }
        }catch(e){
            console.log('exception:', e);
            return null;
        }

    }

    async _update_za_zipcodes(){
        var cityFolder = path.join(tmp, 'cities');
        if( !fs.existsSync(cityFolder) )fs.mkdirSync( cityFolder );
        var zipFile = path.join(cityFolder, 'postalcodes.txt');
        var url = "https://www.postoffice.co.za/Questions/postalcodes.txt";
        try{
            if( !fs.existsSync(zipFile) ){
                console.log('downloading...', url);
                fs.writeFileSync(zipFile, await this.aget(url));
            }
            var txtFile = zipFile
            if( !fs.existsSync(txtFile) ){
                console.log('Could not locate ', txtFile);
                return;
            };

            var columns = [null, null, null, 'city', 'zip', null,'state', 'addr2', 
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
            ];
            var options = {delimiter: ',', quote: '"', columns: columns, raw: false, info: false, relax_column_count: true};
            try{
                var cities = await utils.csv_to_array(txtFile, options);
                for(var city of cities ){
                    var parts = city.state.toLowerCase().split('/');
                    var cityname = city.city.toLowerCase();
                    if( !city.zip )continue;
                    this._add_city_details( {city: cityname, state: parts[0], state_code: parts.length>1?parts[1]:'', country: 'za', zip: city.zip.toLowerCase()} );
                    this._add_zipcode('za', parts.length>1?parts[1]:'', city.zip.toLowerCase(), cityname);
                }
            }catch(e){
                console.log(e);
            }
        }catch(e){
            console.log('exception:', e);
            return null;
        }

    }



    async _update_jp_zipcodes(){
        var columns = ['zip', 'state', 'city', 'other'];
        var options = {delimiter: ',', quote: '"', columns: columns, raw: false, info: false, from: 1};
        var recs = await utils.csv_to_array(path.join(__dirname, 'jpzips.csv'), options);
        var jpjson = JSON.parse(fs.readFileSync(path.join(__dirname, 'jp.json')));
        var zprefix = {};
        for(var rec of recs ){
            jpjson.statecodes[ rec.state ] = rec.state;
            jpjson.states[ rec.state ] = rec.state;
            if( !jpjson.cities.hasOwnProperty(rec.city) )jpjson.cities[rec.city] = rec.state;
            else if( jpjson.cities[rec.city] instanceof Array ){
                if( jpjson.cities[rec.city].indexOf(rec.state)<0 )jpjson.cities[rec.city].push(rec.state);
            }
            else if( jpjson.cities[rec.city] != rec.state )jpjson.cities[rec.city] = rec.state;
            if( rec.zip.indexOf('-')>0 ){
                var prefix = rec.zip.substr(0, rec.zip.indexOf('-'));
                if( !zprefix[prefix] )zprefix[prefix] = {[rec.city]: rec.state};
            }
        }

        // fix state codes and state names
        this._fix_state_suffixes(jpjson, recs);
        fs.writeFileSync(path.join(__dirname, 'jp.json'), JSON.stringify(jpjson, null, 2));
        fs.writeFileSync(path.join(__dirname, 'jpzprefix.json'), JSON.stringify(zprefix, null, 2));
    }

    async _update_us_zipcodes(folder){
        var zips = JSON.parse( fs.readFileSync(path.join(__dirname,'us-zip-code-latitude-and-longitude.json'), 'utf-8' ) );
        var uszips = {};
        for(var zip of zips ){
            if( uszips.hasOwnProperty(zip.fields.zip))console.log('duplicate', zip.fields.zip)
            uszips[zip.fields.zip] = 'us,'+zip.fields.state.toLowerCase()+','+zip.fields.city.toLowerCase();
        }
        var jsfile = path.join(__dirname, 'uszip.json');
        fs.writeFileSync(jsfile, JSON.stringify(uszips, null, 2));

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
                fs.writeFileSync(jsfile, JSON.stringify(ukzips, null, 2));
            }catch(e){
                console.log(e);
            }
        }catch(e){
            console.log('exception:', e);
            return null;
        }

    }


    async _merge_other_zips_for_country(c){
        var fname = path.join(__dirname, 'otherzip.json');
        var otherzipcodes = JSON.parse(fs.readFileSync(fname, 'utf8'));

        var lc = c.toLowerCase();
        for(var zip in otherzipcodes ){
            var parts = otherzipcodes[zip].split(',');
            if( parts[0] == lc ){
                // console.log('    merging otherzips zips for ', lc, zip, parts[2]);
                this._add_city_details( {country: parts[0], state_code: parts[1]||'', city: parts[2]||'', zip: zip} );
                this._add_zipcode(parts[0], parts[1], zip, parts[2]);
            }
        }

        if( c == 'US' ){
            console.log('    merging additional us zip codes');
            var zips = JSON.parse( fs.readFileSync(path.join(__dirname,'us-zip-code-latitude-and-longitude.json'), 'utf-8' ) );
            for(var zip of zips ){
                var statecode = zip.fields.state.toLowerCase();
                this._add_city_details( {country: 'us', state_code: statecode, city: zip.fields.city.toLowerCase()} );
                this._add_zipcode('us', statecode, zip.fields.zip, zip.fields.city.toLowerCase());
            }
        }
        if( c == 'JP' ){
            console.log('    merging additional zips for jp');
            var columns = ['zip', 'state', 'city', 'other'];
            var options = {delimiter: ',', quote: '"', columns: columns, raw: false, info: false, from: 1};
            var recs = await utils.csv_to_array(path.join(__dirname, 'jpzips.csv'), options);
            var prefix={};
            for(var rec of recs ){
                // this._add_city_details( {country: 'jp', state_code: statecode, city: city} );    // jp.json already gets this merged
                var parts = rec.zip.split('-');
                if( parts.length>1 && (!prefix[parts[0]+'-0000'] || parts[1]=='0000') )prefix[parts[0]+'-0000']=rec;
                this._add_zipcode('jp', rec.state, rec.zip, rec.city);
            }
            for(var z in prefix ){
                this._add_zipcode('jp', prefix[z].state, z, prefix[z].city);
            }
        }

        if( c == 'ZA'){ //south africa
            await this._update_za_zipcodes();
        }


        if( c == 'BR' ){
            await this._update_br_zipcodes();
        }

        // if( c == 'GB_full.csv' ){
        //     console.log('    merging additional zips for gb');
        //     var zips = JSON.parse( fs.readFileSync(path.join(__dirname,'ukzip.json'), 'utf-8' ) );
        //     for(var zip in zips ){
        //         this._add_zipcode('uk', zips[zip], zip, '');
        //     }
        // }

    }

    async _update_country_geonames(c, folder){
        var cityFolder = path.join(tmp, 'cities');
        if( !fs.existsSync(cityFolder) )fs.mkdirSync( cityFolder );

        var zipFile = path.join(cityFolder, c+'.zip');
        var url = "http://download.geonames.org/export/zip/"+c+'.zip';
        
        try{
            this.conflicts = 0;
            this.country = {
                states: {},
                cities: {},
                zips: {},
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
            await this._parse_cities_geonames(txtFile, c);
            await this._merge_other_zips_for_country(c);


            console.log(c, 'completed with conflicts', this.conflicts);

            if( folder ){
                var jsfile = path.join(folder, c.replace('_full.csv', '').toLowerCase()+'.json');
                fs.writeFileSync(jsfile, JSON.stringify(this.country, null, 2));
                // if( this.zip ){
                //     jsfile = path.join(folder, 'zip.json');
                //     fs.writeFileSync(jsfile, JSON.stringify(this.zip, null, 2));
                // }
            }
            // utils.rmFile(zipFile);
        }catch(e){
            console.log('exception:', e);
            return null;
        }
    }

    _add_city_state_details(country, city, altname, state){
        country = country.toLowerCase();
        city = this.fix_city_name(city.toLowerCase(), country);
        state = state.toLowerCase();
        altname = this.fix_city_name(altname.toLowerCase(), country);

        var cstate = country+','+state+','+city;
        if( !this.cities.hasOwnProperty(altname) ){
            this.cities[altname] = cstate;
        }
        else if( this.cities[altname] instanceof Array ){
            if( this.cities[altname].indexOf(cstate)<0)this.cities[altname].push(cstate);
        }
        else if( this.cities[altname] != cstate )
            this.cities[altname] = [this.cities[altname], cstate];
    }

    /*
    async _parse_cities_states(fname){
        // var columns = ['geonameid', 'name', 'asciiname', 'alternatenames', false, false, 'fclass', 'fcode', 
        //     'country', 'cc2', 'acode1', 'acode2', false, false, false, false, false, false, false];
        var columns = [false, 'name', 'asciiname', 'alternatenames', false, false, false, false, 
            false, false, 'acode1', false, false, false, false, false, false, false, false];

        var options = {delimiter: '\t', quote: null, columns: columns, raw: false, info: false};
        try{
            var cities = await utils.csv_to_array(fname, options);
            
            for(var city of cities ){
                this._add_city_state_details(city.asciiname, city.acode1);
                var parts = city.alternatenames.split(',').filter(Boolean);
                if( parts.length>0 ){
                    for(var part of parts )this._add_city_state_details(part, city.acode1);
                }
            }
        }catch(e){
            console.log(e);
        }
        
        // console.log(cities);
    }


    
    async _update_city_states(c, folder){
        var cityFolder = path.join(tmp, 'cstates');
        if( !fs.existsSync(cityFolder) )fs.mkdirSync( cityFolder );

        var zipFile = path.join(cityFolder, c+'.zip');
        var url = "https://download.geonames.org/export/dump/"+c+'.zip';
        
        try{
            this.country = {
                cities: {},
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
            await this._parse_cities_states(txtFile);
            
            if( folder ){
                var jsfile = path.join(folder, c.replace('_full.csv', '').toLowerCase()+'-cities.json');
                console.log('writing to: ', jsfile);
                fs.writeFileSync(jsfile, JSON.stringify(this.country, null, 2));
            }
            // utils.rmFile(zipFile);
        }catch(e){
            console.log('exception:', e);
            return null;
        }

    }
    */
    async _parse_geo_cities(fname){
        var columns = [false, 'name', 'asciiname', 'alternatenames', false, false, false, false, 
            'country', false, 'acode1', false, false, false, false, false, false, false, false];

        var options = {delimiter: '\t', quote: null, columns: columns, raw: false, info: false};
        try{
            var cities = await utils.csv_to_array(fname, options);
            
            for(var city of cities ){
                var admin1Code = city.country+'.'+city.acode1;
                var stateCode = this.adminCodes[admin1Code];
                if( !stateCode ){
                    // console.log('could not find admin1Code', admin1Code, city);
                    continue;
                }

                this._add_city_state_details(city.country, city.asciiname, city.asciiname, stateCode);
                var parts = city.alternatenames.split(',').filter(Boolean);
                if( parts.length>0 ){
                    for(var part of parts )this._add_city_state_details(city.country, city.asciiname, part, stateCode);
                }
            }
        }catch(e){
            console.log(e);
        }
        
        console.log(fname, 'done');
    }

    async _geo_admin_codes(){
        var cityFolder = path.join(tmp, 'cstates');
        if( !fs.existsSync(cityFolder) )fs.mkdirSync( cityFolder );
        var txtFile = path.join(cityFolder, 'admin1codes.txt');
        var url = "https://download.geonames.org/export/dump/admin1CodesASCII.txt";
        try{
            
            if( !fs.existsSync(txtFile) ){
                console.log('downloading...', url);
                fs.writeFileSync(txtFile, await this.aget(url));
            }

            var columns = ['code', 'name', 'asciiname', 'geonameid'];
            var options = {delimiter: '\t', quote: null, columns: columns, raw: false, info: false};
            var adminCodes = await utils.csv_to_array(txtFile, options);
            this.adminCodes = adminCodes.reduce( (a,x)=>{a[x.code]=x.asciiname; return a;}, {});
        }catch(e){
            console.log('exception:', e);
            this.adminCodes = {};
            return null;
        }

    }


    async _update_geo_cities(c){
        var cityFolder = path.join(tmp, 'cstates');
        if( !fs.existsSync(cityFolder) )fs.mkdirSync( cityFolder );

        var zipFile = path.join(cityFolder, c+'.zip');
        var url = "https://download.geonames.org/export/dump/"+c+'.zip';
        
        try{
            
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
            await this._parse_geo_cities(txtFile);
            
            // utils.rmFile(zipFile);
        }catch(e){
            console.log('exception:', e);
            return null;
        }
    }

    async _merge_other_zips(){
        var fname = path.join(__dirname, 'otherzip.json');
        var otherzipcodes = JSON.parse(fs.readFileSync(fname, 'utf8'));

        for(var zip in otherzipcodes ){
            var parts = otherzipcodes[zip].split(',');
            this._add_zipcode(parts[0], parts[1], zip, parts[2]);
        }
        // var jsfile = path.join(__dirname, 'zip.json');
        // fs.writeFileSync(jsfile, JSON.stringify(this.zip, null, 2));
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

        for(var c of countries ){
            await this._update_country_geonames(c, __dirname);
        }

        await this._merge_other_zips();

        // all cities from geo cities
        this.cities = {};
        await this._geo_admin_codes();
        for(var c of ['cities1000', 'cities500', 'cities15000', 'cities5000'] )await this._update_geo_cities(c);

        // add our custom made list
        var othercities = JSON.parse( fs.readFileSync(path.join(__dirname, 'other_cities.json'), 'utf-8') );
        for(var c in othercities ){
            var parts = othercities[c].split(',');
            this._add_city_state_details(parts[0], c, parts[2], parts[1]);
        }

        var jsfile = path.join(__dirname, 'geo-cities.json');
        fs.writeFileSync(jsfile, JSON.stringify(this.cities, null, 2));
        // other cities --



        await this._update_jp_zipcodes();
        
        await this._update_us_zipcodes();

        //- await this._update_uk_zipcodes();

        // if( this.zip ){
        //     jsfile = path.join(__dirname, 'zip.json');
        //     fs.writeFileSync(jsfile, JSON.stringify(this.zip, null, 2));
        // }
        this._write_zip_json();
    }

    _read_zip_json(){
        var codes = '0123456789abcdefghijklmnopqrstuvwxyz';
        this.zip = {conflicts:{}};
        for(var prefix in codes ){
            var fname = path.join(__dirname, 'zip', codes[prefix]+'.json');
            try{
                var zips = JSON.parse(fs.readFileSync(fname, 'utf-8' ));
                for(var z in zips )this.zip[z] = zips[z];    
            }catch(e){

            }
        }
    }

    _write_zip_json(){
        //split into small files
        var zips = {};
        for(var z in this.zip ){
            var prefix = z[0];
            if( !zips.hasOwnProperty(prefix) )zips[prefix] = {};
            zips[prefix][z] = this.zip[z];
        }

        for(var prefix in zips ){
            var fname = path.join(__dirname, 'zip', prefix+'.json');
            fs.writeFileSync(fname, JSON.stringify(zips[prefix]) );
        }
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