const path = require('path');
const fs   = require('fs');

class anormalize {
    constructor(){
        this.zips = null;
    }

    load_data(){
        try{
            this.zips = JSON.parse(fs.readFileSync(path.join(__dirname, 'zip.json')));
        }catch(e){
            console.log('could not load zip.json, missing in data dir');
            return false;
        }
        return true;
    }

    _extract_zipcode(parsed){
        if( parsed.parts.length<=2 )return; //nothing to parse
        for(var i=2; i>0; i--){
            if( parts.length<=i )continue;
        }
    }

    process(parts, str){
        var parsed = {parts: parts, address: str, zip: null};
        this._extract_zipcode(parsed);
    }
}

const norm = new anormalize();
norm.load_data();
module.exports = norm;