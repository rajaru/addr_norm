const fs   = require('fs');
const path = require('path');
const utils= require('./utils');

const ordinals = {
    '1st' : 'first',
    '2nd' : 'second',
    '3rd' : 'third',
    '4th' : 'fourrh',
    '5th' : 'fifth',
    '6th' : 'sixth',
    '7th' : 'seventh',
    '8th' : 'eigth',
    '9th' : 'nineth',
    '10th': 'tenthh',
    'I'   : 'first',
    'II'  : 'second',
    'III' : 'third',
    'IV'  : 'fourth',
    'V'   : 'fifth',
}

class data {
    constructor(){
        this.countries = null;
        this.geo = {};
        this.cname = null;
        this.alpha2= null;
        this.alpha3= null;
        this.abbrev= null;
    }

    load_countries(){
        if( !this.countries ){
            var fname = path.join(__dirname, 'country-codes.json');
            this.countries = JSON.parse( fs.readFileSync(fname, 'utf8') );
            this.cname  = this.countries.reduce( (a,x)=>{a[x.name.toLowerCase()] = x; return a;}, {});
            this.alpha2 = this.countries.reduce( (a,x)=>{a[x.alpha2.toLowerCase()] = x; return a;}, {});
            this.alpha3 = this.countries.reduce( (a,x)=>{a[x.alpha3.toLowerCase()] = x; return a;}, {});
        }

        fname = path.join(__dirname, 'en.yml');
        const doc = utils.yaml_to_json(fname);// yaml.safeLoad(fs.readFileSync(fname, 'utf8'));
        this.nameindex = {};
        for(var alpha2 in doc ){
            var c = doc[alpha2];
            var keys = [c.alpha2||'', c.alpha3||'', c.fifa||'', c.iso_name||'', c.official||'', 
                c.short||'', ...(c.aliases||[])];
            for(var key of keys ){
                this.nameindex[key.toLowerCase()] = c.alpha2.toLowerCase();
            }
        }
    }

    _load_country_states(ccode){
        if( this.geo[ ccode ] )return this.geo[ ccode ];
        var fname = path.join(__dirname, ccode+'.json');
        if( fs.existsSync(fname) )this.geo[ ccode ] = JSON.parse( fs.readFileSync(fname, 'utf8') );
        else this.geo[ ccode ] = {cities: {}, states: {}, regions: {}, places: {}, statecodes: {}};
        return this.geo[ ccode ];
    }

    _load_zip_codes(){
        if( this.zipcodes )return;
        var fname = path.join(__dirname, 'zip.json');
        this.zipcodes = JSON.parse(fs.readFileSync(fname, 'utf8'));
    }

    _locate_state_by_name(parts, geo){
        var name = parts.join(' ');
        if( geo.states[name] )return name;
        return null;
    }

    get_state_name(parsed){
        var parts = parsed.parts;
        var ccode = parsed.country || 'us';
        var geo = this._load_country_states(ccode);
        for(var i=4; i>0; i--){
            if( parts.length<=i )continue;

            var name = this._locate_state_by_name( parts.slice(parts.length-i), geo );
            if( name )return this._add_to_parsed(parsed, i, 'state', name);
        }

        // try and locate state by code
        if( geo.statecodes && geo.statecodes[ parts[parts.length-1] ] )
            return this._add_to_parsed(parsed, 1, 'state', geo.statecodes[ parts[parts.length-1] ]);
        
        if( parsed.country && parsed.country != 'us'){
            // its possible that the address did not have country, we mis took state for county
            // check now (we will assume country to be US here)
            geo = this._load_country_states('us');
            if( geo.statecodes[parsed.country] ){
                parsed.state = parsed.country;
                parsed.country = 'us';
                return parsed;
            }
        }

        parsed.state = null;
        return parsed;
    }

    _locate_city_by_name(parts, geo){
        var name = parts.join(' ');
        //console.log('_locate_city_by_name:', name);
        if( geo.cities[name] )return name;
        return null;
    }
    
    get_city_name(parsed){
        //console.log('get_city:', parsed.parts);
        var parts = parsed.parts;
        var ccode = parsed.country || 'us';
        parsed.city = null;
        var geo = this._load_country_states(ccode);
        for(var i=4; i>0; i--){
            if( parts.length<=i )continue;
            var name = this._locate_city_by_name( parts.slice(parts.length-i), geo );
            
            if( name )return this._add_to_parsed(parsed, i, 'city', name);
        }
        return parsed;
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

    _locate_country_from_zip(zip){
        if( !zip )return '';

        this._load_zip_codes();     // load if not already loaded

        //if( this.zipcodes[zip] )return this.zipcodes[zip];
        if( this.zipcodes[zip] )return this.zipcodes[zip].split(',')[0];
        
        // if zip has two parts, try the first part alone.
        var parts = zip.split('-');
        if( parts.length > 1 && this.zipcodes[ parts[0] ])
            return this.zipcodes[parts[0]].split(',')[0];

        return '';
    }

    _locate_state_from_zip(zip){
        if( !zip )return '';

        this._load_zip_codes();     // load if not already loaded
        var cntrystate = this.zipcodes[zip];
        if( !cntrystate ){
            var parts = zip.split('-');
            if( parts.length > 1 )cntrystate = this.zipcodes[parts[0]];
        }
        // console.log('_locate_state_from_zip: ', zip, cntrystate);
        if( !cntrystate )return '';
        var parts = cntrystate.split(',');
        if( parts.length>1 )return parts[1];
        return '';
    }



    _add_to_parsed(parsed, count, key, val){
        var remove = parsed.parts.slice(parsed.parts.length-count);
        for(var part of remove )this.address = this.address.replace(part, '');

        parsed.parts = parsed.parts.slice(0, parsed.parts.length-count);
        parsed[key] = val;
        return parsed;
    }

    get_country_name(parsed){
        // console.log('get_country:', parsed.parts);
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

        // if we have a zip code, lets try and guess country from it
        if( parsed.zip )
            parsed.country = this._locate_country_from_zip(parsed.zip) || null;

        return parsed;
    }

    get_zipcode(parsed){
        if( parsed.zip )return parsed;
        var parts = parsed.parts;
        parsed.zip = null;
        for(var i=2; i>0; i--){
            if( parts.length<=i )continue;
            var part = parts.slice(parts.length-i).join('');
            if( !isNaN(part) )return this._add_to_parsed(parsed, i, 'zip', parts.slice(parts.length-i).join('-'));
        }
        return parsed;
    }

    fix_abbreviations(parsed){
        if( !this.abbrev ){
            var fname = path.join(__dirname, 'street_abbrev.json');
            this.abbrev = JSON.parse(fs.readFileSync(fname, 'utf8'));
        }
        var parts = parsed.parts;
        for(var i=0; i<parts.length; i++){
            if( this.abbrev[parts[i]] )parts[i] = this.abbrev[parts[i]];
        }

        // spanish and other manually updated list
        if( !this.other_abbrev ){
            var fname = path.join(__dirname, 'other_abbrev.json');
            this.other_abbrev = JSON.parse(fs.readFileSync(fname, 'utf8'));
        }
        for(var i=0; i<parts.length; i++){
            if( this.other_abbrev[parts[i]] )parts[i] = this.other_abbrev[parts[i]];
        }


        return parsed;
    }

    fix_ordinals(parsed){
        var parts = parsed.parts;
        for(var i=0; i<parts.length; i++){
            if( ordinals[parts[i]] )parts[i] = ordinals[parts[i]];
        }
        return parsed;
    }

    fix_ambiguity(parsed){
        if( parsed.country && parsed.city && !parsed.state ){
            var geo = this._load_country_states(parsed.country);
            var states = geo.cities[parsed.city];
            // console.log('states for city:', parsed.city, '=>', states)
            
            // if city belongs to one state, we can fix it here
            if( states && typeof states == 'string')parsed.state = states;
            else parsed.state = this._locate_state_from_zip(parsed.zip);
        }
    }

    parse_street(parsed){
        var re = /^\d+\w*\s*(?:(?:[\-\/]?\s*)?\d*(?:\s*\d+\/\s*)?\d+)?\s+/;
        parsed.street = this.address.split(' ').filter(Boolean).join(' ');
        console.log( parsed.street.match(re) );
    }

    parse_address(parts, str){
        this.address = str || '';
        var parsed = {parts: parts};
        parsed = this.get_zipcode(parsed);
        parsed = this.get_country_name(parsed);
        parsed = this.get_zipcode(parsed);
        parsed = this.get_state_name(parsed);
        parsed = this.get_city_name(parsed);
        
        parsed = this.fix_abbreviations(parsed);
        parsed = this.fix_ordinals(parsed);
        this.fix_ambiguity(parsed);
        this.parse_street(parsed);
        return parsed;
    }

}

var dobj = new data();
dobj.load_countries();
module.exports = dobj;