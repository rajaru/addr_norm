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
        if( !this.zipcodes ){
            var fname = path.join(__dirname, 'zip.json');
            this.zipcodes = JSON.parse(fs.readFileSync(fname, 'utf8'));
        }
        if( !this.ukzipcodes ){
            var fname = path.join(__dirname, 'ukzip.json');
            this.ukzipcodes = JSON.parse(fs.readFileSync(fname, 'utf8'));
        }
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
            if( parts.length<i )continue;
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

    _locate_country_from_zip(zip, parsed){
        
        if( !zip )return '';

        this._load_zip_codes();     // load if not already loaded

        var zipcode = zip.split('-')[0];
        var cstate = this.zipcodes[zipcode];

        if( !cstate )cstate = this.ukzipcodes[zipcode];

        if( !cstate ){
            // for canada we have only the first three letters
            if( zip.indexOf(' ')>0 ){
                cstate = this.zipcodes[zip.split(' ')[0]];
            }
        }

        //console.log('_locate_country_from_zip: ', zip, cstate);
        if( cstate ){
            if( !(cstate instanceof Array) )
                return cstate.split(',')[0];        // its country,state combo

            // more than one country/state found. ambiguous

            // see if a matching city is found in any one of the cstate entries
            if( parsed.city ){
                for(var cs of cstate ){
                    var country = cs.split(',')[0];
                    var geo = this._load_country_states(country);
                    if( geo.cities[parsed.city])return country;
                }
            }
        }
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
        if( !cntrystate || (cntrystate instanceof Array) )return '';
        var parts = cntrystate.split(',');
        if( parts.length>1 )return parts[1];
        return '';
    }


    // add the parsed out part to the result and remove from the rest of
    // the address component
    //
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
            parsed.country = this._locate_country_from_zip(parsed.zip, parsed) || null;

        return parsed;
    }

    get_zipcode(parsed){
        if( parsed.zip )return parsed;
        var parts = parsed.parts;
        parsed.zip = null;
        for(var i=2; i>0; i--){
            if( parts.length<=i )continue;
            var part = parts.slice(parts.length-i).join('');
            if( !isNaN(part) )
                return this._add_to_parsed(parsed, i, 'zip', parts.slice(parts.length-i).join('-'));
            else {
                // lookup zips to check if its valid
                if( this._locate_country_from_zip(part, parsed) )
                    return this._add_to_parsed(parsed, i, 'zip', part);
                part = parts.slice(parts.length-i).join(' ');
                if( this._locate_country_from_zip(part, parsed) )
                    return this._add_to_parsed(parsed, i, 'zip', part);
            }
        }
        return parsed;
    }

    fix_abbreviation(word){
        word = (word || '' ).trim();
        if( !word )return word;
        if( word[word.length-1] == '.' )word = word.substr(0, word.length-1)

        if( !this.abbrev ){
            var fname = path.join(__dirname, 'street_abbrev.json');
            this.abbrev = JSON.parse(fs.readFileSync(fname, 'utf8'));
        }
        if( !this.other_abbrev ){
            var fname = path.join(__dirname, 'other_abbrev.json');
            this.other_abbrev = JSON.parse(fs.readFileSync(fname, 'utf8'));
        }


        if( this.abbrev[word] )word = this.abbrev[word];
        if( this.other_abbrev[word] )word = this.other_abbrev[word];
        if( ordinals[word] )word = ordinals[word];

        return word;
    }

    /*
    fix_abbreviations(parts){
        
        for(var i=0; i<parts.length; i++){
            parts[i] = this.fix_abbreviation(parts[i]);
        }

        for(var i=0; i<parts.length; i++){
            parts[i] = this.fix_abbreviation(parts[i]);
        }

        return parts;
    }

    fix_ordinals(parsed){
        var parts = parsed.parts;
        for(var i=0; i<parts.length; i++){
            if( ordinals[parts[i]] )parts[i] = ordinals[parts[i]];
        }
        return parsed;
    }*/

    fix_ambiguity(parsed){
        if( parsed.zip && parsed.city && !parsed.country ){
            parsed.country = this._locate_country_from_zip(parsed.zip, parsed) || null;
        }

        if( parsed.country && parsed.city && !parsed.state ){
            var geo = this._load_country_states(parsed.country);
            var states = geo.cities[parsed.city];
            // console.log('states for city:', parsed.city, '=>', states)
            
            // if city belongs to one state, we can fix it here
            if( states && typeof states == 'string')parsed.state = states;
            else parsed.state = this._locate_state_from_zip(parsed.zip);

            if( !parsed.state ){
                // look up and find if there is a state with same name as city
                if( geo.states[parsed.city] )parsed.state = parsed.city;
            }
        }
        else if( parsed.country && parsed.state && !parsed.city ){
            var geo = this._load_country_states(parsed.country);
            // check if we have a city with the same name as state
            if( geo.cities[parsed.state] )parsed.city = parsed.state;
        }
    }

    parse_street(parsed){
        parsed.street = this.address.split(' ').filter(Boolean).join(' ').trim();
        parsed.door = null;
        //var re = /^(\b#|\bno)?\.?\s?(\d+[\-|\/]?\w?)+(\s+apt\s+#?\d+\w?(-\d+\w?)*)?/gi
        //var re = /^(\b#|\bno)?\.?\s?(\d+[\-|\/]?\w?)+\s+(apt\s+#?\d+\w?)?/i;

        const regex = /^(\b#|\bno)?\.?\s?(\d+[\-|\/]?\w?)+(\s+apt\s+#?\d+\w?(-\d+\w?)*)?/gim;
        var matches = parsed.street.match(regex);
        if( matches && matches.length>0 ){
            parsed.door = matches[0];
            parsed.street = parsed.street.replace(parsed.door, '').trim();
        }

        var str = '';
        var word = '';
        var separators = " \t\r\n-,";
        for(var c of parsed.street){
            if( separators.indexOf(c)>=0){
                str += this.fix_abbreviation(word)+c;
                word = '';
            }
            else{
                word += c;
            }
        }
        str += this.fix_abbreviation(word);
        str = str.replace(/[\-\,\*]/ig, ' ').split(' ').filter(Boolean).join(' ');
        parsed.street = str;
    }

    parse_address(parts, str){
        this.address = str || '';
        var parsed = {parts: parts};
        parsed = this.get_zipcode(parsed);
        parsed = this.get_country_name(parsed);
        parsed = this.get_zipcode(parsed);
        parsed = this.get_state_name(parsed);
        parsed = this.get_city_name(parsed);
        
        // parsed = this.fix_abbreviations(parsed);
        // parsed = this.fix_ordinals(parsed);

        this.fix_ambiguity(parsed);
        this.parse_street(parsed);
        return parsed;
    }

}

var dobj = new data();
dobj.load_countries();
module.exports = dobj;