const fs   = require('fs');
const path = require('path');
const utils= require('./utils');



class data {
    constructor(){
        this.countries = null;
        this.geo = {};
        this.cname = null;
        this.alpha2= null;
        this.alpha3= null;
    }

    async load(){
        await this.load_countries();
    }

    async load_countries(){
        if( !this.countries ){
            var fname = path.join(__dirname, 'country-codes.csv');
            var countries = await utils.csv_to_json(fname); //await this._csv_to_json(fname);
            this.countries = countries.map( x => ({
                "name" : x['official_name_en'] || '',
                "un-es-short" : x["UNTERM English Short"],
                "dial" : x["Dial"],
                "fifa" : x['FIFA'],
                "fips" : x["FIPS"],
                "alpha3" : x["ISO3166-1-Alpha-3"],
                "alpha2" : x["ISO3166-1-Alpha-2"]
                })
            );
            
            this.cname  = this.countries.reduce( (a,x)=>{a[x.name.toLowerCase()] = x; return a;}, {});
            this.alpha2 = this.countries.reduce( (a,x)=>{a[x.alpha2.toLowerCase()] = x; return a;}, {});
            this.alpha3 = this.countries.reduce( (a,x)=>{a[x.alpha3.toLowerCase()] = x; return a;}, {});
            console.log('loaded')
        }
        fname = path.join(__dirname, 'en.yml');
        const doc = utils.yaml_to_json(fname);// yaml.safeLoad(fs.readFileSync(fname, 'utf8'));
        this.nameindex = {};
        for(var alpha2 in doc ){
            var c = doc[alpha2];
            var keys = [c.alpha2||'', c.alpha3||'', c.fifa||'', c.iso_name||'', c.official||'', 
                c.short||'', ...(c.aliases||[])];
            for(var key of keys ){
                this.nameindex[key.toLowerCase()] = c.alpha2;
            }
        }
    }

    async _load_country_states(ccode){
        if( this.geo[ ccode ] )return this.geo[ ccode ];
        var fname = path.join(__dirname, ccode+'.json');
        if( fs.existsSync(fname) )this.geo[ ccode ] = JSON.parse( fs.readFileSync(fname, 'utf8') );
        else this.geo[ ccode ] = {cities: {}, states: {}, regions: {}, places: {}, statecodes: {}};
        return this.geo[ ccode ];
    }

    _locate_state_by_name(parts, geo){
        var name = parts.join(' ');
        if( geo.states[name] )return geo.states[name];
        return null;
    }

    async get_state_name(parsed){
        var parts = parsed.parts;
        var ccode = parsed.country || 'us';

        var geo = await this._load_country_states(ccode);
        for(var i=4; i>0; i--){
            if( parts.length<=i )break;

            var name = this._locate_state_by_name( parts.slice(parts.length-i), geo );
            if( name )return this._add_to_parsed(parsed, i, 'state', name);
        }

        // try and locate state by code
        if( geo.statecodes && geo.statecodes[ parts[parts.length-1] ] )
            return this._add_to_parsed(parsed, 1, 'state', parts[parts.length-1]);
        
        parsed.state = null;
        return parsed;
    }

    _locate_city_by_name(parts, geo){
        var name = parts.join(' ');
        if( geo.cities[name] )return geo.cities[name];
        return null;
    }
    
    async get_city_name(parsed){
        var parts = parsed.parts;
        var ccode = parsed.country || 'us';
        parsed.city = null;
        var geo = await this._load_country_states(ccode);
        for(var i=4; i>0; i--){
            if( parts.length>i ){
                var name = this._locate_city_by_name( parts.slice(parts.length-i), geo );
                if( name )return this._add_to_parsed(parsed, i, 'city', name);
            }
        }
        return parsed;
    }
    
    _locate_country_by_name(parts){
        var name = parts.join(' ');
        if( this.cname[name] )return this.cname[name].alpha2;
        if( this.nameindex[name] )return this.nameindex[name];
        return null;
    }
    _locate_country_by_alpha2(parts){
        var name = parts[ parts.length-1 ];
        if( this.alpha2[name] )return this.alpha2[name].alpha2;
        if( this.nameindex[name] )return this.nameindex[name];
        return null;
    }
    _locate_country_by_alpha3(parts){
        var name = parts[ parts.length-1 ];
        if( this.alpha3[name] )return this.alpha3[name].alpha2;
        if( this.nameindex[name] )return this.nameindex[name];
        return null;
    }

    _add_to_parsed(parsed, count, key, val){
        parsed.parts = parsed.parts.slice(0, parsed.parts.length-count);
        parsed[key] = val;
        return parsed;
    }

    async get_country_name(parsed){
        var parts = parsed.parts;
        parsed.country = null;
        // try full country name from last
        for(var i=4; i>0; i--){
            if( parts.length<=i )break;
            var name = this._locate_country_by_name( parts.slice(parts.length-i) );
            if( name )return this._add_to_parsed(parsed, i, 'country', name);
        }

        name = this._locate_country_by_alpha2( parts );
        if( name )return this._add_to_parsed(parsed, 1, 'country', name);

        name = this._locate_country_by_alpha3( parts );
        if( name )return this._add_to_parsed(parsed, 1, 'country', name);

        return parsed;
    }

    async get_zipcode(parsed){
        if( parsed.zip )return parsed;
        var parts = parsed.parts;
        parsed.zip = null;
        for(var i=2; i>0; i--){
            if( parts.length<=i )break;
            var part = parts.slice(parts.length-i).join('');
            if( !isNaN(part) )return this._add_to_parsed(parsed, i, 'zip', parts.slice(parts.length-i).join('-'));
        }
        return parsed;
    }

    async parse_address(parts){
        var parsed = {parts: parts};
        parsed = await this.get_zipcode(parsed);
        parsed = await this.get_country_name(parsed);
        parsed = await this.get_zipcode(parsed);
        parsed = await this.get_state_name(parsed);
        parsed = await this.get_city_name(parsed);
        return parsed;
    }

}

var dobj = new data();
module.exports = dobj;