const fs   = require('fs');
const path = require('path');
const utils= require('./utils');

class data {
    constructor(){
        this.countries = null;
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
        if( this.alpha3[name] )return this.alpha3[name];
        if( this.nameindex[name] )return this.nameindex[name];
        return null;
    }

    get_country_name(parts){
        // try full country name from last
        for(var i=4; i>0; i--){
            if( parts.length>i ){
                var name = this._locate_country_by_name( parts.slice(parts.length-i) );
                if( name )return {parts: parts.slice(0, parts.length-i), name: name};
            }
        }

        // var name = this._locate_country_by_name( parts.slice(parts.length-3) );
        // if( name )return {parts: parts.slice(0, parts.length-3), name: name};
        
        // name = this._locate_country_by_name( parts.slice(parts.length-2) );
        // if( name )return {parts: parts.slice(0, parts.length-2), name: name};

        // name = this._locate_country_by_name( parts.slice(parts.length-1) );
        // if( name )return {parts: parts.slice(0, parts.length-1), name: name};

        name = this._locate_country_by_alpha2( parts );
        if( name )return {parts: parts.slice(0, parts.length-1), name: name};

        name = this._locate_country_by_alpha3( parts );
        if( name )return {parts: parts.slice(0, parts.length-1), name: name};

        return {parts: parts, name: null};
    }

}

var dobj = new data();
// dobj.load_countries(); //this will not be ready until sometime
module.exports = dobj;