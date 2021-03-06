const path = require('path');
const fs   = require('fs');
const argentina= require('./argentina');
const utils= require('./utils');
const crypto=require('crypto');
const {performance}        = require('perf_hooks');
const diacrt = require('diacritics');
diacrt.diacriticsMap['ä'] = 'ae';
diacrt.diacriticsMap['ö'] = 'oe';
diacrt.diacriticsMap['ü'] = 'ue';


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


class anormalize {
    constructor(dbg){
        this.dbg = dbg;
        this.zipz = null;
        this.loaded = {};
        this.geo = {};
        this.geo_citites = {};
        this.cityhash = {};
    }

    _fix_jp_names(city){
        var suffix = [/ ken$/, / to$/, / fu$/, / do$/, / gun$/, / shi$/, / ku$/, / machi$/, / cho$/, / mura$/, / son$/];
        for(var suf of suffix ){
            city = city.replace(suf, '');
        }
        return city;
    }

    _check_uk_zip(zip){
        // return false;
        // The letters Q, V and X are not used in the first position.
        // second is alpha-numneric except i,j,z
        // third optional alpha numeric with A, B, C, D, E, F, G, H, J, K, S, T, U and W
        // fourth alpha-numneric with A, B, E, H, M, N, P, R, V, W, X and Y
        var rex = /^[abcedfghijklmnoprstuwyz][abcdefghklmnopqrsty0-9](?:[abcdefghjkstuw0-9][abehmnprvwxz0-9]?)?\s?[0-9][abdefghjlnpqrstuwxyz0-9][abdefghjlnpqrstuwxyz0-9]$/;
        return zip.match(rex);
    }

    __english(name){
        if( this.english[name] )name = this.english[name];
        name = diacrt.remove(name);
        return name;
    }

    __update_zip_cities(zips){
        for(var z in zips ){
            var str = JSON.stringify( zips[z] );
            var md5 = crypto.createHash('md5');
            var hash = md5.update(str).digest('hex');
            if( !this.cityhash.hasOwnProperty(hash) )this.cityhash[hash] = zips[z];
            this.zipz[z] = this.cityhash[hash]; //use it as reference
        }
        // this.cityhash = {};
    }

    __load_zip_code(prefix){
        if( !this.loaded[prefix] ){
            var fname = path.join(__dirname, 'zip', prefix+'.json');
            try{
                const mem = process.memoryUsage();
                console.log('loading ', fname, (mem.heapUsed/1024/1024).toFixed(2), 'MB');
                const zips = JSON.parse(fs.readFileSync(fname, 'utf-8' ));
                //for(var z in zips )this.zipz[z] = zips[z];
                this.__update_zip_cities(zips);
                zips = null;
            }catch(e){
                // console.log(e);
            }
            this.loaded[prefix] = true;
        }
    }


    __zips(zip){
        if( !zip )return null;
        this.__load_zip_code('0');
        this.__load_zip_code(zip[0]);
        var countries = null;
        if( this.zipz[zip] )countries = this.zipz[zip];
        // if( zip.length==4 && this.zipz['0'+zip] )countries = {...countries, ...this.zipz['0'+zip]};
        return countries;
        // if( !this.loaded[zip[0]] ){
        //     var fname = path.join(__dirname, 'zip', zip[0]+'.json');
        //     try{
        //         // console.log(zip, ':', fname);
        //         var zips = JSON.parse(fs.readFileSync(fname, 'utf-8' ));
        //         for(var z in zips )this.zipz[z] = zips[z];
        //     }catch(e){
        //     }
        //     this.loaded[zip[0]] = true;
        // }
        // if( this.zipz[zip] )return this.zipz[zip];
        // if( zip.length==4 && this.zipz['0'+zip] )return this.zipz['0'+zip];
        // return null;
    }

    load_data(){
        var start = performance.now();
        try{
            var codes = '0123456789abcdefghijklmnopqrstuvwxyz';
            this.zipz = {conflicts:{}};
            // for(var prefix in codes ){
            //     var fname = path.join(__dirname, 'zip', codes[prefix]+'.json');
            //     try{
            //         console.log(fname);
            //         var zips = JSON.parse(fs.readFileSync(fname, 'utf-8' ));
            //         for(var z in zips )this.zipz[z] = zips[z];
            //     }catch(e){
            //     }
            // }
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
            var keys = [/*c.alpha2||'',*/ c.alpha3||'', c.fifa||'', c.iso_name||'', c.official||'', 
                c.short||'', ...(c.aliases||[])];
            for(var key of keys ){
                this.nameindex[key.toLowerCase()] = c.alpha2.toLowerCase();
            }
        }
        this.geo_citites = JSON.parse( fs.readFileSync(path.join(__dirname, 'geo-cities.json'), 'utf-8') );
        this.english = JSON.parse( fs.readFileSync(path.join(__dirname, 'english.json'), 'utf-8') );
        console.log('loaded data in ', (performance.now()-start).toFixed(2), 'ms', 'zips', Object.keys(this.zipz).length);
        return true;
    }
    _add_to_parsed(parsed, count, key, val){
        var remove = parsed.parts.slice(parsed.parts.length-count);
        for(var part of remove )parsed.address = parsed.address.replace(part, '');

        parsed.parts = parsed.parts.slice(0, parsed.parts.length-count);
        
        if( key == 'city' && parsed.country == 'jp')val = this._fix_jp_names(val);
        
        parsed[key] = val;
        return parsed;
    }

    _get_countries_from_zip(zip){
        if( zip.endsWith('-000') )zip = zip.replace('-000', '');
        var zipcode= null;
        var countries = null;
        if( !countries){ zipcode=zip.replace(' ', '-'); countries = this.__zips(zipcode) ? Object.keys(this.__zips(zipcode)) : null;}
        if( !countries){ zipcode=zip.split('-')[0]; countries = this.__zips(zipcode) ? Object.keys(this.__zips(zipcode)) : null;}
        if( !countries){ zipcode=zip.split(' ')[0]; countries = this.__zips(zipcode) ? Object.keys(this.__zips(zipcode)) : null;}
        if( !countries){ zipcode=zip.split('-').join(''); countries = this.__zips(zipcode) ? Object.keys(this.__zips(zipcode)) : null;}
        if( !countries){ zipcode=zip.split(' ').join(''); countries = this.__zips(zipcode) ? Object.keys(this.__zips(zipcode)) : null;}
        if( !countries){ zipcode=zip; countries = argentina(zip)};
        if( !countries){
            var re = /^(\d\d\d){1}-\d\d\d\d$/gim
            var matches = re.exec(zip.replace(' ', '-'));
            if( matches && matches.length>1 ){
                console.log('zip could be jp', zipcode)
                zipcode=matches[1]; countries = ['jp'];
            }
        }
        if( !countries){    // bermuda post boxes
            var re = /^([a-z][a-z])-[a-z][a-z]$/gim
            var matches = re.exec(zip.replace(' ', '-'));
            if( matches && matches.length>1 ){
                console.log('zip could be be', zipcode)
                zipcode=matches[1]+'-01'; countries = ['be'];
            }

        }

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
            if(this.dbg)console.log('country from zip', zip, countries);
            if( countries ){
                this._add_to_parsed(parsed, i, 'zip', zipcode);
                if( this.dbg )console.log('zip-countries: ', countries);
                parsed.guessed.countries = countries;
                break;
            }
            if( this._check_uk_zip(zip) ){
                this._add_to_parsed(parsed, i, 'zip', zip);
                parsed.guessed.countries = ['gb'];
            }
        }
    }


    _locate_country_by_name(parts){
        var name = parts.join(' ');
        if(this.dbg)console.log('locate_country_by_name: ', name);
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
        if(this.dbg)console.log('locate_state_by_name: ', name, 'ccode:', ccode, geo.states[name]);
        if( geo.states[name] ){
            if(this.dbg)console.log('    found in ', name);
            return name;
        }
        if( geo.statecodes && geo.statecodes[name] ){
            if(this.dbg)console.log('    found (code) in ', name);
            return name;
        }

        var ename = this.__english(name);
        if( geo.states[ename] ){
            if(this.dbg)console.log('    found in englsh ', name, ename);
            return ename;
        }

        return null;
    }

    _locate_city_in_geo_names(name, ccode){
        var geo = this.__geo(ccode);
        if( geo.cities[name] )return {city: name, state: geo.cities[name], country: ccode};

        if(ccode == 'jp'){// leave a space in the front
            var suffix = [' ken', ' to', ' fu', ' do', ' gun', ' shi', ' ku', ' machi', ' cho', ' mura', ' son'];
            for(var suf of suffix ){
                var aname = name.replace(suf, '');
                if( geo.cities[aname] )return {city: aname, state: geo.cities[aname], country: ccode};
            }
            for(var suf of suffix ){
                var aname = name.replace(suf, suf.substr(1));
                if( geo.cities[aname] )return {city: aname, state: geo.cities[aname], country: ccode};
            }
        }

        var ename = this.__english(name);
        if( geo.cities[ename] )return {city: ename, state: geo.cities[ename], country: ccode};
        return null;
    }

    _locate_city(name, ccode){
        if(this.dbg )console.log('locate city: ', name, 'ccode:', ccode);
        var city = this._locate_city_in_geo_names(name, ccode);
        if( city ){
            if(this.dbg )console.log('    found: ', city);
            return city;
        }

        var cnst = this.geo_citites[name];  //city-alt-name: country, state, city name
        if( !cnst )return {city: null, state: null, country: null};

        if( !(cnst instanceof Array) ){
            var parts = cnst.split(',');
            if(this.dbg)console.log('    : potential match', parts);
            if( ccode == null || ccode == parts[0] ){
                if(this.dbg>=2)console.log('    : found', parts[2], parts[1], parts[0]);
                return {city: parts[2], state: parts[1], country: parts[0]}; //common mame
            }
            return {city: null, state: null, country: null};
        }
        // console.log('   ', cnst);
        // found multiple cities with this name, lets cross reference and see potential matches for this country
        if( ccode ){
            var fcnsts = cnst.filter(x=>x.split(',')[0]==ccode);
            if( fcnsts.length>0 ){
                var parts = fcnsts[0].split(',');
                return {city: parts[2], state: parts[1], country: parts[0]}; //common mame
            }    
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
        if( name ){   // if we have a country from zip, this must match that
            if( parsed.guessed.countries.indexOf(name)>=0 ){
                return this._add_to_parsed(parsed, 1, 'country', name);
            }
        }

        name = this._locate_country_by_alpha3( parts );
        if( name )return this._add_to_parsed(parsed, 1, 'country', name);

        if( parsed.guessed.countries && parsed.guessed.countries.length==1 )parsed.country = parsed.guessed.countries[0];
    }

    __geo(ccode){
        if( this.geo[ ccode ] )return this.geo[ ccode ];
        
        this.geo[ ccode ] = {cities: {}, states: {}, regions: {}, places: {}, statecodes: {}};
        var fname = path.join(__dirname, ccode+'.json');
        if( fs.existsSync(fname) )this.geo[ ccode ] = JSON.parse( fs.readFileSync(fname, 'utf8') );

        return this.geo[ ccode ];

    }

    _extract_state_name(parsed, us){
        var parts = parsed.parts;
       
        var guessed_countries = parsed.country || parsed.guessed.countries || [];
        if( !(guessed_countries instanceof Array) )guessed_countries = [guessed_countries];

        if( us )guessed_countries = ['us'];
        else guessed_countries = [...guessed_countries]; // make a copy

        // if( guessed_countries.indexOf('us')<0 )
        //     guessed_countries = [...guessed_countries, 'us']; // make a copy
        // else
        //     guessed_countries = [...guessed_countries]; // make a copy

        for(var i=4; i>0; i--){
            if( parts.length<=i )continue;

            for(var ccode of guessed_countries ){
                var name = this._locate_state_in_country( parts.slice(parts.length-i), ccode );
                if( name ){
                    if( parsed.country == ccode )
                        return this._add_to_parsed(parsed, i, 'state', name);
                    else{
                        // console.log('    to state guessed: ', {country: ccode, state: name, index: i});
                        parsed.guessed.states.push({country: ccode, state: name, index: i});
                    }
                 }
            }
        }

        if( parsed.guessed.states.length==1 ){
            if( !parsed.coountry )parsed.country = parsed.guessed.states[0].country;
            return this._add_to_parsed(parsed, parsed.guessed.states[0].index, 'state', parsed.guessed.states[0].state);
        }

    }

    __state(parsed, state, city){
        if( parsed.state || !parsed.country )return;
        if( state instanceof Array ){
            var countries = this.__zips(parsed.zip);
            if( countries && countries[parsed.country] ){
                parsed.state = this.__fix_state(parsed.country, countries[parsed.country][city]) || null;
            }                                
        }
        else
            parsed.state = state;
    }

    __extract_city_name(parsed, guessed_countries, skip){
        var parts = parsed.parts;
        skip = skip || 0;
        if( parsed.country ){
            for(var i=4+skip; i>skip; i--){
                if( parts.length<i )continue;
                var cparts = parts.slice(parts.length-i, parts.length-skip);
                var city = this._locate_city_in_geo_names(cparts.join(' '), parsed.country);
                if( !city && cparts.length>1  )city = this._locate_city_in_geo_names(cparts.reverse().join(' '), parsed.country);
                if( city ){
                    this.__state(parsed, city.state, city.city);
                    return this._add_to_parsed(parsed, i, 'city', city.city);
                }
            }
        }

        var countries = guessed_countries;

        // lets use guessed countries and try
        for(var i=4+skip; i>skip; i--){
            if( parts.length<i )continue;
            var cparts = parts.slice(parts.length-i, parts.length-skip);

            if( !parsed.zip && !parsed.country ){
                var cnst = this.geo_citites[cparts.join(' ')];
                if( !cnst )this.geo_citites[cparts.reverse().join(' ')];
                if( cnst ){
                    if( !(cnst instanceof Array) )cnst = [cnst];
                    countries = ['us'];
                    for(var ccs of cnst)countries.push(ccs.split(',')[0]);
                    guessed_countries = [...new Set(countries)]; //dedupe
                    if(this.dbg)console.log('    zip not provided, get countries from global cities', guessed_countries);    
                }
            }
    

            for(var j=0; j<countries.length; j++ ){
                var ccode = countries[j];
                
                cparts = parts.slice(parts.length-i, parts.length-skip);    //reverse is inplace
                var {city, state, country} = this._locate_city( cparts.join(' '), ccode );
                if( !city && cparts.length>1 )this._locate_city( cparts.reverse().join(' '), ccode );
                if( !city )continue;

                state = this.__fix_state(country, state);

                // we have nothing, what we get is here is good enough
                if( !parsed.zip && ( !parsed.country || parsed.country == country) ){
                    if(this.dbg)console.log('    found in global cities', city, state, country);
                    if( parsed.state && state != parsed.state )console.log('state mismatch ', parsed.state, '!=', state);
                    if( !parsed.country )parsed.country = country;
                    this.__state(parsed, state, city);
                    this._add_to_parsed(parsed, i, 'city', city);
                    return true;
                }

                // if we have 2 countries guessed one must be US and lets check if
                if( !parsed.country && j==0 && countries.length<3 ){
                    parsed.country = countries[0];
                    this._add_to_parsed(parsed, i, 'city', city);
                    return true;
                }

                // lets add the city to the potential list of cities if not already added
                var found = parsed.guessed.cities.filter( x=>x.country==country&&x.city==city&&x.state==state);
                if(found.length==0){
                    parsed.guessed.cities.push({country: country, city: city, state: state, index: i});
                }
            }
        }

        // if we have guessed only one, that must be it
        if( parsed.guessed.cities.length==0 )return;

        if( parsed.guessed.cities.length==1 ){
            parsed.country = parsed.guessed.cities[0].country;
            parsed.city = parsed.guessed.cities[0].city;
            var states = parsed.guessed.cities[0].state;
            if( states instanceof Array ){
                var zips = this.__zips(parsed.zip);
                if( zips && zips[parsed.country] ){
                    // console.log('zip country', zips[parsed.country]);
                    if( zips[parsed.country][parsed.city] )parsed.state = zips[parsed.country][parsed.city];
                }
            }
            else
                parsed.state = states;
        }

        if( parsed.country ){
            parsed.guessed.cities = parsed.guessed.cities.filter(x=>x.country==parsed.country);
        }


        if( this.dbg )console.log('    found ', parsed.guessed.cities.length, 'cities', parsed.guessed.cities);

        // if all our guesses are in one country, merge guessed states and cities
        var countries = [parsed.country];
        if( !parsed.country ){
            countries = parsed.guessed.cities.map(x=>x.country);
            countries = [...new Set(countries)]; //dedupe
            if( countries.length == 1 )parsed.country = countries[0];
            else if( this.dbg )console.log('    found in ', countries.length, ' different countries');
        }

        if( !parsed.country ){
            // cross check guessed cities with corresponding geo names
            var zips = this.__zips(parsed.zip);
            for(var cobj of parsed.guessed.cities){
                if( zips[cobj.city] ){
                    console.log('zipcity: ', cobj);
                }
            }
        }

        // get states 
        if( !parsed.state ){
            var states = parsed.guessed.cities.map( x=>x.state instanceof Array ? x.state : [x.state]);
            var ret = states[0];
            for(var state of states )
                ret = ret.filter(x => state.includes(x));
            if( ret.length>1 )return false;
            parsed.state = ret[0];    
        }
        
        


        return false;

    }




    __extract_city_name1(parsed, guessed_countries, skip){
        // if we have only one guessed country (that will be us) then lets try a match without country as well
        if( guessed_countries.length == 1 )guessed_countries = [...guessed_countries, null];

        if( parsed.country )guessed_countries = [parsed.country];


        var parts = parsed.parts;
        skip = skip || 0;
        for(var i=4+skip; i>skip; i--){
            if( parts.length<i )continue;

            for(var ccode of guessed_countries ){
                var cparts = parts.slice(parts.length-i, parts.length-skip);
                var {city, state, country} = this._locate_city( cparts.join(' '), ccode );

                if( !city && i==2 ){ //swap and try
                    var {city, state, country} = this._locate_city( cparts[1]+' '+cparts[0], ccode );
                }

                if( !city )continue;

                state = this.__fix_state(country, state);

                if( !parsed.zip && !parsed.country /*&& !parsed.state*/ ){
                    // whatever we got is golden
                    if( parsed.state && state != parsed.state )console.log('state mismatch ', parsed.state, '!=', state);
                    parsed.country = country;
                    this.__state(parsed, state, city);
                    this._add_to_parsed(parsed, i, 'city', city);
                    return true;
                }

                if( parsed.country == country ){
                    this.__state(parsed, state, city);
                    this._add_to_parsed(parsed, i, 'city', city);
                    return true;
                }
                else if( guessed_countries.length>0 && guessed_countries.length<3 && guessed_countries[0] == country ){
                    // console.log('matches guessed country: ',guessed_countries[0], city, state, country);
                    parsed.country = guessed_countries[0];
                    this._add_to_parsed(parsed, i, 'city', city);
                    return true;
                }
                else{
                    // console.log('    adding to guess', city, state, country);

                    var found = parsed.guessed.cities.filter( x=>x.country==country&&x.city==city&&x.state==state);
                    if(found.length==0){
                        parsed.guessed.cities.push({country: country, city: city, state: state, index: i});
                    }
                    else{
                        // console.log('    ', found);
                    }
                }
            }
        }
        
        // console.log('    resolve city', parsed.guessed.cities.length);
        if( parsed.guessed.cities.length==0 )return;

        if( parsed.guessed.cities.length==1 ){
            parsed.country = parsed.guessed.cities[0].country;
            parsed.city = parsed.guessed.cities[0].city;
            var states = parsed.guessed.cities[0].state;
            if( states instanceof Array ){
                var zips = this.__zips(parsed.zip);
                if( zips && zips[parsed.country] ){
                    // console.log('zip country', zips[parsed.country]);
                    if( zips[parsed.country][parsed.city] )parsed.state = zips[parsed.country][parsed.city];
                }
            }
            else
                parsed.state = states;
        }

        // merge guessed states and cities
        if( !parsed.country ){
            var countries = parsed.guessed.cities.map(x=>x.country);
            countries = [...new Set(countries)];
            if( countries.length>1 )return false;
            parsed.country = countries[0];
        }

        // get states 
        if( !parsed.state ){
            var states = parsed.guessed.cities.map( x=>x.state instanceof Array ? x.state : [x.state]);
            var ret = states[0];
            for(var state of states )
                ret = ret.filter(x => state.includes(x));
            if( ret.length>1 )return false;
            parsed.state = ret[0];    
        }
        

        return false;
    }

    __fix_state(ccode, state){
        if( !state )return null;
        var geo = this.__geo(ccode);
        if( state instanceof Array )return state;
        if( geo.states[state] )return geo.states[state];
        //if( geo.statecodes[state] )return geo.statecodes[state];
        return state;
    }

    _extract_city_name(parsed, us){
        var guessed_countries = parsed.country || parsed.guessed.countries || [];
        if( !(guessed_countries instanceof Array) )guessed_countries = [guessed_countries];

        if( us )guessed_countries = ['us'];
        else guessed_countries = [...guessed_countries]; // make a copy


        // if( guessed_countries.indexOf('us')<0 )
        //     guessed_countries = [...guessed_countries, 'us']; // make a copy
        // else
        //     guessed_countries = [...guessed_countries]; // make a copy

        if( this.dbg )console.log('city: guessed ', guessed_countries);
        if( this.__extract_city_name(parsed, guessed_countries, 0) )return true;
        if( this.__extract_city_name(parsed, guessed_countries, 1) )return true;

        if( parsed.city )return true;

        // cross reference guessed city names against their zip city names
        var matches = [];
        for(var cobj of parsed.guessed.cities ){
            var geo = this.__geo(cobj.country);
            var zcountry = this.__zips(parsed.zip);
            var cities = zcountry ? zcountry[cobj.country] : null;
            if( cities ){
                if(this.dbg)console.log('zip cities: ', parsed.zip, cobj.country, cities);
                if( cities[cobj.city] )matches.push( cobj );
            }
        }

        if( matches.length==0 )return;

        if( matches.length==1 ){
            if( !parsed.country )parsed.country = matches[0].country;
            if( !parsed.state ){
                if( !(matches[0].state instanceof Array) )
                    parsed.state = matches[0].state;
                else{
                    var zcountry = this.__zips(parsed.zip);
                    if( this.dbg>2 )console.log('state ambiguity: ', zcountry);
                    var states = zcountry[parsed.country];
                    if( states && states[matches[0].city] )parsed.state =states[matches[0].city];
                }
            }
            
            return this._add_to_parsed(parsed, matches[0].index, 'city', matches[0].city);
        }
        else{
            if(this.dbg )console.log('x-matched: ', matches);
        }

        // merge guessed states and cities
        if( !parsed.country ){
            var countries = matches.map(x=>x.country);
            countries = [...new Set(countries)];
            if( countries.length>1 )return false;   // we still have more than one country
            parsed.country = countries[0];
            if( !parsed.city )parsed.city = matches[0].city;
        }

        // get states 
        if( !parsed.state ){
            var states = matches.map( x=>x.state instanceof Array ? x.state : [x.state]);
            var ret = states[0];
            for(var state of states )
                ret = ret.filter(x => state.includes(x));
            if( ret.length>1 )return false;         // ambiguous list of states
            parsed.state = ret[0];
        }

        // some cities have same name as their state
        // if( parsed.country && parsed.state ){
        //     var geo = this.__geo(parsed.country);
        //     if( geo.cities[parsed.state] )parsed.city = parsed.state;
        // }

    }

    _final_fix(parsed){
        // some cities have same name as their state
        if( parsed.state && parsed.country && !parsed.city ){
            var geo = this.__geo(parsed.country);
            if( geo.cities[parsed.state] )parsed.city = parsed.state;
        }
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


    _parse_street(parsed){
        parsed.street = parsed.address.split(' ').filter(Boolean).join(' ').trim();
        parsed.door = null;

        // \b word boundaries

        const dregexs = [
            /^(\b#|\bno)?\.?\s?(\d+[\-|\/]?\w?)+(\s+apt\s+#?\d+\w?(-\d+\w?)*)?/gim,
            /\s*(\d+\-\d+(?:\-\d+)?)\s*/,                                            // ...nnn-mmm(-xxx)...
            /^\s*level\s+(\d+[[,\-\s]+\d+]?)\s*/im                                   // level nnn(,- mmm)....
        ];

        for(var rex of dregexs){
            var matches = parsed.street.match(rex);
            if( matches && matches.length>0 ){
                parsed.door = matches.length>1 ? matches[1].trim() : matches[0].trim();
                parsed.street = parsed.street.replace(parsed.door, '').trim();
                break;
            }
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
        var parsed = {parts: parts, address: str, zip: null, guessed: {states: [], cities: [], countries: []}};
        this._extract_zipcode(parsed);
        this._extract_country_name(parsed);
        this._extract_zipcode(parsed);
        this._extract_state_name(parsed);
        this._extract_city_name(parsed);

        if( !parsed.country && !parsed.city && !parsed.state ){
            this._extract_state_name(parsed, true);
            this._extract_city_name(parsed, true);
        }

        this._final_fix(parsed);
        this._parse_street(parsed);
        this.fix_zip_code(parsed);

        return parsed;
    }

    ztest(){
        var start = performance.now();
        const alphanum = '0123456789abcdefghijklmnopqrstuvwxyz';
        for(var p of alphanum ){
            this.__load_zip_code(p);
        }
        if( global.gc )global.gc(true);
        var mem = process.memoryUsage();
        console.log('time consumed: ', (performance.now()-start).toFixed(2), 'ms');
        console.log('heap consumed: ', (mem.heapUsed/1024/1024).toFixed(2), ' / ', (mem.heapTotal/1024/1024).toFixed(2) );
    }
}

const norm = new anormalize();
norm.load_data();
module.exports = norm;