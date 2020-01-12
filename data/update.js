const fs = require('fs');
const path = require('path');
const request = require('request');
const unzip = require('unzipper');
const utils= require('./utils');

const tmp = "z:\\tmp\\out";
const countries = [
    'GB_full.csv', 'NL_full.csv', 'US', 'IN'
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

    _add_city_details(rec){
        for(var key in rec )rec[key] = (rec[key]||'').toLowerCase();
        if( rec.city  )this.country.cities[rec.city ] = 1;
        if( rec.state )this.country.states[rec.state] = 1;
        if( rec.region)this.country.regions[rec.region]=1;
        if( rec.place )this.country.places[rec.place] = 1;
        if( rec.state_code && !Number.isInteger(rec.state_code) )this.country.statecodes[rec.state_code] = 1;
    }

    async _parse_cities_geonames(fname){
        var columns = [false, false, 'city', 'state', 'state_code', 'region', false, 'place', false, false, false, false];
        var options = {delimiter: '\t', quote: null, columns: columns, raw: false, info: false};
        try{
            var cities = await utils.csv_to_array(fname, options);
            
            for(var city of cities ){
                //this._add_city_details( city.city, city.state, city.region, city.place);
                this._add_city_details( city );
            }
        }catch(e){
            console.log(e);
        }
        
        // console.log(cities);
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
            if( !fs.existsSync(zipFile) )
                fs.writeFileSync(zipFile, await this.aget(url));
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
            }
            // utils.rmFile(zipFile);
        }catch(e){
            console.log('exception:', e);
            return null;
        }
    }

    async cities(){
        for(var c of countries )
            await this._update_country_geonames(c, __dirname);
    }
}

module.exports = new update();