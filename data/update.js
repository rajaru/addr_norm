const fs = require('fs');
const path = require('path');
const request = require('request');
const unzip = require('unzipper');
const utils= require('./utils');

const tmp = "c:\\tmp\\out";
const countries = [
    'GB_full.csv'/*, 'NL_full.csv', 'US', 'IN'*/
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

    _add_city_details(name, state, regn, place){
        name = (name ||'').trim().toLowerCase();
        state= (state||'').trim().toLowerCase();
        regn = (regn ||'').trim().toLowerCase();
        place= (place||'').trim().toLowerCase();

        if( name && state ){
            if( !this.city_state.hasOwnProperty(state) )this.city_state[state] = [];
            this.city_state[state].push( name );
        }
    }

    async _parse_cities_geonames(fname){
        var columns = [false, false, 'place', 'state', false, 'region', false, 'city', false, false, false, false];
        var options = {delimiter: '\t', quote: null, columns: columns, raw: false, info: false};
        try{
            var cities = await utils.csv_to_array(fname, options);
            
            for(var city of cities ){
                this._add_city_details( city.city, city.state, city.region, city.place);
            }
        }catch(e){
            console.log(e);
        }
        
        // console.log(cities);
    }

    async _update_country_geonames(c, folder){
        var cityFolder = path.join(tmp, 'cities');
        if( !fs.existsSync(cityFolder) )fs.mkdirSync( cityFolder );

        var zipFile = path.join(cityFolder, 'cities.zip');
        var url = "http://download.geonames.org/export/zip/"+c+'.zip';
        
        try{
            this.city_state = {};
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
                var jsfile = path.join(folder, c+'.json');
                console.log(jsfile);
                fs.writeFileSync(jsfile, JSON.stringify(this.city_state));    
            }
            // console.log(this.city_state);
            utils.rmFile(zipFile);
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