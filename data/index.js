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

/*
const us_zip_range = {
    'al' : ['35801', '35816'],
    'ak' : ['99501', '99524'],
    'az' : ['85001', '85055'],
    'ar' : ['72201', '72217'],
    'ca' : ['94203', '94209', '90001', '90089', '90209', '90213'],
    'co' : ['80201', '80239'],
    "ct" : ["06101", "06112"],
    "de" : ["19901", "19905"],
    "dc" : ["20001", "20020"],
    "fl" : ["32501", "32509","33124","33190","32801","32837"],
    "ga" : ["30301", "30381"],
    "hi" : ["96801", "96830"],
    "id" : ["83254", "83254"],
    "il" : ["60601", "60641", "62701","62709"],
    "in" : ["46201", "46209"],
    "ia" : ["52801", "52809", "50301","50323"],
    "ks" : ["67201", "67221"],
    "ky" : ["41701", "41702"],
    "la" : ["70112", "70119"],
    "me" : ["04032", "04034"],
    "md" : ["21201", "21237"],
    "ma" : ["02101", "02137"],
    "mi" : ["49036", "49036", "49734","49735"],
    "mn" : ["55801", "55808"],
    "ms" : ["39530", "39535"],
    "mo" : ["63101", "63141"],
    "mt" : ["59044", "59044"],
    "ne ": ["68901", "68902"],
    "nv" : ["89501", "89513"],
    "nh" : ["03217", "03217"],
    "nj" : ["07039", "07039"],
    "nm" : ["87500", "87506"],
    "ny" : ["10001", "10048"],
    "nc" : ["27565", "27565"],
    "nd" : ["58282", "58282"],
    "oh" : ["44101", "44179"],
    "ok" : ["74101", "74110"],
    "or" : ["97201", "97225"],
    "pa" : ["15201", "15244"],
    "ri" : ["02840", "02841"],
    "sc" : ["29020", "29020"],
    "sd" : ["57401", "57402"],
    "tn" : ["37201", "37222"],
    "tx" : ["78701", "78705"],
    "ut" : ["84321", "84323"],
    "vt" : ["05751", "05751"],
    "va" : ["24517", "24517"],
    "va" : ["98004", "98009"],
    "wv" : ["25813", "25813"],
    "wi" : ["53201", "53228"],
    "wy" : ["82941", "82941"],
};

function is_in_us_zip_range(zip){
    var part = zip.split('-')[0];
    for(var state in us_zip_range){
        var zrange = us_zip_range[state];
        for(var i=0; i<zrange.length; i+=2 ){
            if( part >= zrange[i] && part <= zrange[i] )return state;
        }
    }
    return null;
}
*/

const twzips = {
    '100' : 'tw,taipei',
    '220' : 'tw,taipei',
    '800' : 'tw,kaohsiung',
    '200' : 'tw,keelung',
    '300' : 'tw,hsinchu',
    '400' : 'tw,taichung',
    '600' : 'tw,chiayi',
    '700' : 'tw,tainan',
}



class data {
    constructor(dbg){
        this.dbg = dbg || false;
        this.countries = null;
        this.geo = {};
        this.cname = null;
        this.alpha2= null;
        this.alpha3= null;
        this.abbrev= null;
        this.geo_citites = null;
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
        if( !this.jpzipcodes ){
            var fname = path.join(__dirname, 'jpzip.json');
            this.jpzipcodes = JSON.parse(fs.readFileSync(fname, 'utf8'));
        }
        if( !this.uszipcodes ){
            var fname = path.join(__dirname, 'uszip.json');
            this.uszipcodes = JSON.parse(fs.readFileSync(fname, 'utf8'));
        }
    }

    _locate_state_by_name(parts, geo){
        var name = parts.join(' ');
        if(this.dbg)console.log('_locate_state_by_name: ', name);
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

    _locate_city_by_name(parts, geo, country){
        var name = parts.join(' ');
        if(this.dbg)console.log('_locate_city_by_name:', name);
        if( geo.cities[name] )return name;

        if(country == 'jp'){
            // leave a space in the front
            var suffix = [' ken', ' to', ' fu', ' do', ' gun', ' shi', ' ku', ' machi', ' cho', ' mura', ' son'];
            for(var suf of suffix ){
                var aname = name.replace(suf, '');
                if( geo.cities[aname] )return aname;
            }
        }

        if(this.geo_citites === null ){
            this.geo_citites = {};
            try{
                this.geo_citites = JSON.parse( fs.readFileSync(path.join(__dirname, 'geo-cities.json'), 'utf-8') );
            }catch(e){}
        }

        if( this.geo_citites[name] ){
            // if(this.dbg)console.log('check in geo cities', name, this.geo_citites[name]);
            var gc = this.geo_citites[name];
            if( !(gc instanceof Array) ){
                if(this.dbg)console.log('found in geo cities', name, gc.split(',')[2]);
                return gc.split(',')[2];
            }
        }

        return null;
    }
    
    get_city_name(parsed){
        var parts = parsed.parts;
        var ccode = parsed.country || 'us';
        parsed.city = null;
        var geo = this._load_country_states(ccode);
        for(var i=4; i>0; i--){
            if( parts.length<i )continue;
            var name = this._locate_city_by_name( parts.slice(parts.length-i), geo, ccode );
            
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

    _get_cstate_from_zip(zipcode){
        var cstate = this.zipcodes[zipcode];
        if( !cstate )cstate = this.ukzipcodes[zipcode];
        if( !cstate )cstate = this.jpzipcodes[zipcode];
        return cstate;
    }

    _locate_country_from_zip(zip, parsed, fixothers){
        if(this.dbg)console.log('locate_country_from_zip: ', zip);
        if( !zip )return '';

        this._load_zip_codes();     // load if not already loaded

        var zipcode = zip.split('-')[0];
        var cstate = this._get_cstate_from_zip(zipcode);
        if( !cstate){ zipcode=zip.split(' ')[0]; cstate = this._get_cstate_from_zip(zipcode);}
        if( !cstate){ zipcode=zip.split('-').join(''); cstate = this._get_cstate_from_zip(zipcode);}
        if( !cstate){ zipcode=zip.split(' ').join(''); cstate = this._get_cstate_from_zip(zipcode);}

        if(this.dbg)console.log('locate_country_from_zip: found ', zip, zipcode, cstate);

        // var zipcode = zip.split('-')[0];
        // var cstate = this.zipcodes[zipcode];

        // if( !cstate )cstate = this.ukzipcodes[zipcode];
        // if( !cstate )cstate = this.jpzipcodes[zipcode];
        

        // if( !cstate ){
        //     // for canada we have only the first three letters
        //     if( zip.indexOf(' ')>0 ){
        //         cstate = this.zipcodes[zip.split(' ')[0]];
        //     }
        //     else if( zip.indexOf('-')>0 ){
        //         cstate = this.zipcodes[zip.split('-')[0]];
        //         if(this.dbg)console.log('locate_country_from_zip: trying ', zip, zip.split('-')[0]);
                
        //     }
        // }

        if( cstate ){
            
            if( !(cstate instanceof Array) ){
                if(this.dbg)console.log('locate_country_from_zip: found ', zip, cstate);
                return cstate.split(',')[0];        // its country,state combo
            }

            // more than one country/state found. ambiguous
            if(this.dbg)console.log('locate_country_from_zip: more found ', zip, cstate);

            // see if a matching city is found in any one of the cstate entries
            if( parsed.city || parsed.state ){
                for(var cs of cstate ){
                    var parts = cs.split(',');
                    var country = parts[0];
                    var state   = parts[1];
                    var geo = this._load_country_states(country);
                    if( parsed.city ){
                        if( geo.cities[parsed.city]){
                            if(this.dbg)console.log('locate_country_from_zip: found ', zip, country);
                            if( fixothers && !parsed.state )parsed.state = state;
                            return country;
                        }    
                    }
                    else if( parsed.state ){
                        if( geo.states[parsed.state] || geo.statecodes[parsed.state] ){
                            if(this.dbg)console.log('locate_country_from_zip: found ', zip, country);
                            return country;
                        }    

                    }

                }

                // try and locate from global cities lists
                for(var cs of cstate ){
                    var parts = cs.split(',');
                    var country = parts[0];
                    var state   = parts[1];

                    if( parsed.city ){
                        var cstates = this.geo_citites[parsed.city];
                        if( cstates ){
                            if(this.dbg)console.log('locate_country_from_zip: found in global cities', zip, cstates);
                            if( !(cstates instanceof Array) ){
                                if( fixothers ){
                                    if( !parsed.state )parsed.state = cstates.split(',')[1];
                                }
                                return country;
                            }
                            else{
                                var fstates = cstates.filter(x=>x.split(',')[0]==country);
                                if( fstates.length==1 ){
                                    if(this.dbg)console.log('locate_country_from_zip: found in global cities (matching country)', zip, fstates);
                                    if( !parsed.state )parsed.state = fstates[0].split(',')[1];
                                    return country;
                                }
                            }

                        }
                    }
                }


            }
        }

        // lets make a guess from the zip format
        if( zip.match(/^\d\d\d[\- ]\d\d\d\d$/) ){
            if(this.dbg)console.log('locate_country_from_zip: found jp: ', zip);
            return 'jp';
        }


        // this matches things like york usa
        // if( zip.match(/^[a-z0-9][a-z0-9][a-z0-9]?[a-z0-9]? [a-z0-9][a-z0-9][a-z0-9]$/) ){
        //     if(this.dbg)console.log('locate_country_from_zip: found gb: ', zip);
        //     return 'gb';
        // }

        if( fixothers ){
            cstate = this.uszipcodes[zipcode];
            
            if( cstate ){
                if( !(cstate instanceof Array) ){
                    var parts = cstate.split(',');
                    if( !parsed.state )parsed.state = parts[1];
                    if( !parsed.city  )parsed.city = parts[2];
                    return parts[0];
                }
            }
        }

        return '';
    }

    _locate_state_from_zip(zip, country){
        if( !zip )return '';

        if(this.dbg)console.log('_locate_state_from_zip:', zip);
        this._load_zip_codes();     // load if not already loaded
        var cntrystate = this.zipcodes[zip];
        if( !cntrystate ){
            var parts = zip.split('-');
            if( parts.length > 1 )cntrystate = this.zipcodes[parts[0]];
        }
        if( !cntrystate)this.ukzipcodes[zip];
        if( !cntrystate)this.jpzipcodes[zip];

        if(this.dbg)console.log('_locate_state_from_zip: ', zip, cntrystate);
        if( !cntrystate )return '';

        if( (cntrystate instanceof Array) ){
            // check if we have a unique state for this country
            if( !country )return '';
            var cstate = cntrystate.filter( x=>x.split(',')[0]==country);
            if( cstate.length!=1 ){
                if(this.dbg)console.log('_locate_state_from_zip: more than one state found', zip, cstate);
                return '';    //we need to find exactly one match
            }
            cntrystate = cstate[0];
        }
        
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
            if( !isNaN(part) ){
                if(this.dbg)console.log('get_zipcode: ', part);
                return this._add_to_parsed(parsed, i, 'zip', parts.slice(parts.length-i).join('-'));
            }
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

    fix_ambiguity(parsed){
        if( parsed.zip /*&& parsed.city*/ && !parsed.country ){
            parsed.country = this._locate_country_from_zip(parsed.zip, parsed, true) || null;
        }

        // if( parsed.zip && !parsed.country && !parsed.state ){
        //     parsed.state = is_in_us_zip_range(parsed.zip);
        //     if(this.dbg && parsed.state )console.log('found state from us zip range ', parsed.zip, parsed.state);
        // }

        if( parsed.country && parsed.city && !parsed.state ){
            var geo = this._load_country_states(parsed.country);
            var states = geo.cities[parsed.city];
            // console.log('states for city:', parsed.city, '=>', states)
            
            // if city belongs to one state, we can fix it here
            if( states && typeof states == 'string')parsed.state = states;
            else parsed.state = this._locate_state_from_zip(parsed.zip, parsed.country);

            if( !parsed.state ){
                // look up and find if there is a state with same name as city
                if( geo.states[parsed.city] )parsed.state = parsed.city;
            }
        }
        else if( parsed.country && parsed.state && !parsed.city ){
            var geo = this._load_country_states(parsed.country);
            // check if we have a city with the same name as state
            //if(this.dbg)console.log('city-state: ', geo.cities[parsed.state]);
            if( geo.cities[parsed.state] )parsed.city = parsed.state;
        }
        else if( parsed.country && !parsed.state && !parsed.city && parsed.zip){
            parsed.state = this._locate_state_from_zip(parsed.zip, parsed.country);
        }
        else if( parsed.city && !parsed.country ){
            var cstates = this.geo_citites[parsed.city];
            if( cstates ){
                if(this.dbg)console.log('fix from city: found in global cities', parsed.city, cstates);
                if( !(cstates instanceof Array) ){
                    var parts = cstates.split(',');
                    parsed.country = parts[0];
                    if( !parsed.state )parsed.state = parts[1];
                }
                else{
                    if(this.dbg)console.log('fix from city: multiple found in global cities', parsed.city, cstates);
                }

            }

        }
        
    }

    parse_street(parsed){
        parsed.street = this.address.split(' ').filter(Boolean).join(' ').trim();
        parsed.door = null;

        const dregexs = [
            /^(\b#|\bno)?\.?\s?(\d+[\-|\/]?\w?)+(\s+apt\s+#?\d+\w?(-\d+\w?)*)?/gim,
            /\s*(\d+\-\d+(?:\-\d+)?)\s*/
        ];

        for(var rex of dregexs){
            var matches = parsed.street.match(rex);
            if( matches && matches.length>0 ){
                parsed.door = matches[0].trim();
                parsed.street = parsed.street.replace(parsed.door, '').trim();
                break;
            }
        }

        // const regex = /^(\b#|\bno)?\.?\s?(\d+[\-|\/]?\w?)+(\s+apt\s+#?\d+\w?(-\d+\w?)*)?/gim;
        // var matches = parsed.street.match(regex);
        // if( matches && matches.length>0 ){
        //     parsed.door = matches[0];
        //     parsed.street = parsed.street.replace(parsed.door, '').trim();
        // }

        // if( !parsed.door ){
        //     // try number format nn-nn-nn
        //     const dregex = /\s+(\d+\-\d+(?:\-\d+)?)\s*/
        //     var matches = parsed.street.match(dregex);
        //     if( matches && matches.length>0 ){
        //         parsed.door = matches[0];
        //         parsed.street = parsed.street.replace(parsed.door, '').trim();
        //     }
        // }


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
        str = str.replace(/[\(\)]/g, '');
        str = str.replace(/[\-\,\*]/ig, ' ').split(' ').filter(Boolean).join(' ');
        
        parsed.street = str;
    }

    fix_zip_code(parsed){
        if( !parsed.zip )return;
        if( parsed.country == 'in' )
            parsed.zip = parsed.zip.split('-').join('');
        else if( parsed.country == 'us' )
            parsed.zip = parsed.zip.split('-')[0];
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
        this.fix_zip_code(parsed);

        return parsed;
    }

}

var dobj = new data();
dobj.load_countries();
module.exports = dobj;