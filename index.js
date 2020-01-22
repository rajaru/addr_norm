const data = require('./data');
const update = require('./data/update');
const yargs = require('yargs');

class address{
    constructor(dbg){
        this.dbg = dbg || false;
    }

    _print_params(){
        console.log(arguments);
    }

    _apply_regex_params(str, rexp, count){
        for(var i=0; i<4; i++){
            var tmp = str.replace(rexp, (...args)=>
                args[1] 
                + (count>1?args[2] || '':'')
                + (count>2?args[3] || '':'')
                + (count>3?args[4] || '':'')
                + (count>4?args[5] || '':'')
                + (count>5?args[6] || '':'')
            );
            if( tmp == str )return str;
            str = tmp;
        }
        return str;
    }

    _remove(str){
        var rex = [
            /\(?european\s+territory\)?/ig
        ];
        
        for(var i=0; i<rex.length; i++)
            str = str.replace(rex[i], '');
        return str;
    }

    // free form address text to be parsed and normalized
    //
    normalize(str){
        var rex = [
            {exp: /([\S|\s]*)(\S)\.(\S)\.(\S)[\.]?([\S|\s]*)/g, count: 6},  //U.S.A
            {exp: /([\S|\s]*)(\S)\.(\S)[\.]?([\S|\s]*)/g, count: 5},        //U.S
            {exp: /([\S|\s]*)(\S\S\S)\.([\S|\s]*)/g, count: 4},            //USA.
            {exp: /([\S|\s]*)(\S\S)\.([\S|\s]*)/g, count: 4}              //US.
        ];
        str = str.toLowerCase().trim();
        str = this._remove(str);
        for(var i=0; i<rex.length; i++)
            str = this._apply_regex_params( str, rex[i].exp, rex[i].count);

        var address = str;
        str = str.replace(/-/g, ' ');
        str = str.replace(/,/g, ' ');
        str = str.replace(/[\(\)]/g, '');

        var parts = str.split(/\s+/g) || [];
        if( this.dbg )data.dbg = true;
        return data.parse_address( parts.filter(Boolean), address );
    }
}
module.exports = new address();

/* for CLI */
yargs.option('addr', {describe: 'Address to parse'});
yargs.option('update', {describe: 'Update all or specific data set'});
yargs.option('debug', {describe: 'Enable debug print'});
setTimeout(async ()=>{
    if( yargs.argv.addr ){
        var addr = new address(yargs.argv.debug);
        console.log(addr.normalize(yargs.argv.addr));
    }
    if( yargs.argv.update ){
        await update.cities();
        await update.street_abbreviations();
    }
}, 1);
