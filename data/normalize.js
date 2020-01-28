const path = require('path');
const fs   = require('fs');
const argentina= require('./argentina');
const utils= require('./utils');
const {performance}        = require('perf_hooks');

class anormalize {
    constructor(dbg){
        this.dbg = dbg;
        this.zips = null;
        this.geo = {};
        this.geo_citites = {};
    }

    load_data(){
        var start = performance.now();
        try{
            this.zips = JSON.parse(fs.readFileSync(path.join(__dirname, 'zip.json')));
        }catch(e){
            console.log('could not load zip.json, missing in data dir');
            return false;
        }

        this.countries = JSON.parse( fs.readFileSync(path.join(__dirname, 'country-codes.json'), 'utf8') );
        this.cname  = this.countries.reduce( (a,x)=>{a[x.name.toLowerCase()] = x; return a;}, {});
        this.alpha2 = this.countries.reduce( (a,x)=>{a[x.alpha2.toLowerCase()] = x; return a;}, {});
        this.alpha3 = this.countries.reduce( (a,x)=>{a[x.alpha3.toLowerCase()] = x; return a;}, {});

        const doc = utils.yaml_to_json(path.join(__dirname, 'en.yml'));// yaml.safeLoad(fs.readFileSync(fname, 'utf8'));
        this.nameindex = {};
        for(var alpha2 in doc ){
            var c = doc[alpha2];
            var keys = [c.alpha2||'', c.alpha3||'', c.fifa||'', c.iso_name||'', c.official||'', 
                c.short||'', ...(c.aliases||[])];
            for(var key of keys ){
                this.nameindex[key.toLowerCase()] = c.alpha2.toLowerCase();
            }
        }
        this.geo_citites = JSON.parse( fs.readFileSync(path.join(__dirname, 'geo-cities.json'), 'utf-8') );
        console.log('loaded data in ', (performance.now()-start).toFixed(2), 'ms');
        return true;
    }
    _add_to_parsed(parsed, count, key, val){
        var remove = parsed.parts.slice(parsed.parts.length-count);
        for(var part of remove )parsed.address = parsed.address.replace(part, '');

        parsed.parts = parsed.parts.slice(0, parsed.parts.length-count);
        parsed[key] = val;
        return parsed;
    }

    _get_countries_from_zip(zip){
        if( zip.endsWith('-000') )zip = zip.replace('-000', '');
        var zipcode= null;
        var countries = null;
        if( !countries){ zipcode=zip.replace(' ', '-'); countries = this.zips[zipcode];}
        if( !countries){ zipcode=zip.split('-')[0]; countries = this.zips[zipcode];}
        if( !countries){ zipcode=zip.split(' ')[0]; countries = this.zips[zipcode];}
        if( !countries){ zipcode=zip.split('-').join(''); countries = this.zips[zipcode];}
        if( !countries){ zipcode=zip.split(' ').join(''); countries = this.zips[zipcode];}
        if( !countries){ zipcode=zip; countries = argentina(zip)};
        return {countries, zipcode};

    }

    _extract_zipcode(parsed){
        if( parsed.zip )return;
        if( parsed.parts.length<=2 )return; //nothing to parse
        var parts = parsed.parts;

        for(var i=2; i>0; i--){
            if( parts.length<=i )continue;
            
            var zip = parts.slice(parts.length-i).join(' ');
            var {countries, zipcode} = this._get_countries_from_zip(zip);
            if( countries ){
                this._add_to_parsed(parsed, i, 'zip', zipcode);
                parsed.guessed.countries = countries;
                break;
            }
        }
    }


    _locate_country_by_name(parts){
        var name = parts.join(' ');
        if( this.cname[name] )return this.cname[name].alpha2.toLowerCase();
        if( this.nameindex[name] )return this.nameindex[name];
        return null;
    }
    _locate_country_by_alpha2(parts){
        var name = parts[ parts.length-1 ];
        if( this.alpha2[name] )return this.alpha2[name].alpha2.toLowerCase();
        if( this.nameindex[name] )return this.nameindex[name];
        return null;
    }
    _locate_country_by_alpha3(parts){
        var name = parts[ parts.length-1 ];
        if( this.alpha3[name] )return this.alpha3[name].alpha2.toLowerCase();
        if( this.nameindex[name] )return this.nameindex[name];
        return null;
    }
    _locate_state_in_country(parts, ccode){
        var geo = this.__geo(ccode);
        var name = parts.join(' ');
        if( geo.states[name] ){
            if(this.dbg)console.log('locate_state_by_name: found in ', geo, name);
            return name;
        }
        if( geo.statecodes && geo.statecodes[name] ){
            if(this.dbg)console.log('locate_state_by_name: found (code) in ', geo, name);
            return name;
        }
        return null;
    }

    _locate_city_in_geo_names(name, ccode){
        var geo = this.__geo(ccode);
        if( geo.cities[name] )return {city: name, state: geo.cities[name]};

        if(ccode == 'jp'){// leave a space in the front
            var suffix = [' ken', ' to', ' fu', ' do', ' gun', ' shi', ' ku', ' machi', ' cho', ' mura', ' son'];
            for(var suf of suffix ){
                var aname = name.replace(suf, '');
                if( geo.cities[aname] )return {city: aname, state: geo.cities[aname]};
            }
        }
        return null;
    }

    _locate_city(name, ccode){
        var city = this._locate_city_in_geo_names(name, ccode);
        if( city )return city;

        var cnst = this.geo_citites[name];  //city-alt-name: country, state, city name
        if( !cnst )return {city: null, state: null, country: null};

        if( !(cnst instanceof Array) ){
            var parts = cnst.split(',');
            if( ccode != parts[0])
                console.log('warning: city matches but not country, expected', ccode, 'found', parts[0]);
            return {city: parts[2], state: parts[1], country: parts[0]}; //common mame
        }

        // found multiple cities with this name, lets cross reference and see potential matches for this country
        var fcnsts = cnst.filter(x=>x.split(',')[0]==ccode);
        if( fcnsts.length>0 ){
            var parts = fcnsts[0].split(',');
            return {city: parts[2], state: parts[1], country: parts[0]}; //common mame
        }
        return {city: null, state: null, country: null};
    }

    _extract_country_name(parsed){
        var parts = parsed.parts;
        parsed.country = null;

        // try full country name from last
        for(var i=4; i>0; i--){
            if( parts.length<=i )continue;
            var name = this._locate_country_by_name( parts.slice(parts.length-i) );
            if( name )return this._add_to_parsed(parsed, i, 'country', name);
        }

        name = this._locate_country_by_alpha2( parts );
        if( name )return this._add_to_parsed(parsed, 1, 'country', name);

        name = this._locate_country_by_alpha3( parts );
        if( name )return this._add_to_parsed(parsed, 1, 'country', name);
    }

    __geo(ccode){
        if( this.geo[ ccode ] )return this.geo[ ccode ];
        
        this.geo[ ccode ] = {cities: {}, states: {}, regions: {}, places: {}, statecodes: {}};
        var fname = path.join(__dirname, ccode+'.json');
        if( fs.existsSync(fname) )this.geo[ ccode ] = JSON.parse( fs.readFileSync(fname, 'utf8') );

        return this.geo[ ccode ];

    }

    _extract_state_name(parsed){
        var parts = parsed.parts;
       
        var guessed_countries = parsed.country || [...parsed.guessed.countries] || [];
        if( !(guessed_countries instanceof Array) )guessed_countries = [guessed_countries];
        guessed_countries.push('us');

        for(var i=4; i>0; i--){
            if( parts.length<=i )continue;

            for(var ccode of guessed_countries ){
                var name = this._locate_state_in_country( parts.slice(parts.length-i), ccode );
                if( name ){
                    if( parsed.country == ccode )
                        return this._add_to_parsed(parsed, i, 'state', name);
                    else
                        parsed.guessed.states.push({country: ccode, state: name});
                }
            }
        }
    }

    _extract_city_name(parsed){
        var parts = parsed.parts;

        var guessed_countries = parsed.country || parsed.guessed.countries || [];
        if( !(guessed_countries instanceof Array) )guessed_countries = [guessed_countries];
        guessed_countries.push('us');

        for(var i=4; i>0; i--){
            if( parts.length<i )continue;
            for(var ccode of guessed_countries ){
                var {city, state, country} = this._locate_city( parts.slice(parts.length-i), ccode );
                if( city ){
                    if( parsed.country == country )
                        return this._add_to_parsed(parsed, i, 'city', city);
                    else{
                        console.log('city guessed: ', {country: country, city: city, state: state})
                        parsed.guessed.cities.push({country: country, city: city, state: state});
                    }
                }
            }
        }

        if( !parsed.city ){
            // cross reference guessed city names against their zip city names
            var matches = [];
            for(var cobj of parsed.guessed.cities ){
                var geo = this.__geo(cobj.country);
                console.log('zip city: ', cobj.country, cobj.city, geo.zips[parsed.zip]);
                if( geo.zips[parsed.zip] == cobj.city )
                    matches.push( cobj );
            }
            console.log('x-matched: ', matches);
        }
    }

    parse_address(parts, str){
        var parsed = {parts: parts, address: str, zip: null, guessed: {states: [], cities: []}};
        this._extract_zipcode(parsed);
        this._extract_country_name(parsed);
        this._extract_zipcode(parsed);
        this._extract_state_name(parsed);
        this._extract_city_name(parsed);
        return parsed;
    }
}

const norm = new anormalize();
norm.load_data();
module.exports = norm;