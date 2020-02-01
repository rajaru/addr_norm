const fs   = require('fs');
const path = require('path');
const csv  = require('csv');
const yaml = require('js-yaml');

class utils {
    static _csv_to_json_cb(fname, options, cb){
        var data = [];
        options = options || {escape:'\\'};
        var parser = csv.parse(options);
        var fstream = fs.createReadStream(fname);
        var headers = null;
        parser.on('readable', async ()=>{
            if( !headers )headers = parser.read();
            var row = null;
            while( (row=parser.read()) ){
                row = row.map(s => s.trim());
                row = row.reduce( (a,v,i)=>{a[headers[i]]=v; return a;}, {});
                data.push(row);
                process.stderr.write('\r'+data.length);
            }
        });
        parser.on('error', function(e){console.log('error: ', e);cb(e.message);});
        parser.on('end', async ()=>{
            parser.end();
            cb(headers, data);
        });
        fstream.pipe(parser);
    }
    
    static async csv_to_json(fname, options){
        process.stderr.write('loading '+fname+'...');
        return new Promise((resolve, reject)=>{
            utils._csv_to_json_cb(fname, options, (headers, data)=>{
            if( data ){
                process.stderr.write('\rdone                                                  \n');
                resolve(data);
            }
            else
                reject(headers);
            });
        });
    }



    static _csv_to_array_cb(fname, options, cb){
        var data = [];
        options = options || {escape:'\\'};
        var parser = csv.parse(options);
        var fstream = fs.createReadStream(fname);
        parser.on('readable', async ()=>{
            var row = null;
            while( (row=parser.read()) ){
                row = row.map(s => s.trim());
                data.push(row);
                process.stderr.write('\r'+data.length);
            }
        });
        parser.on('error', function(e){console.log('error: ', e);cb(e.message);});
        parser.on('end', async ()=>{
            parser.end();
            cb(null, data);
        });
        fstream.pipe(parser);
    }

    static async csv_to_array(fname, options){
        process.stderr.write('loading '+fname+'...');
        return new Promise((resolve, reject)=>{
            utils._csv_to_array_cb(fname, options, (headers, data)=>{
            if( data ){
                process.stderr.write('\rdone                                                  \n');
                resolve(data);
            }
            else
                reject(headers);
            });
        });
    }

    static yaml_to_json(fname){
        return yaml.safeLoad(fs.readFileSync(fname, 'utf8'));
    }
    
    static rmdir(folder) {
        if( !fs.existsSync(folder) )return;

        var files = fs.readdirSync(folder);
        files.forEach(function(file, index){
            var curPath = path.join(folder, file);
            if(fs.lstatSync(curPath).isDirectory()){    //its a folder
                utils.rmdir(curPath);
            }
            else{
                fs.unlinkSync(curPath); //its a file
            }
        });
        fs.rmdirSync(folder);
    }

    static rmFile(fpath){
        try{
            //iif:
            if(fs.lstatSync(fpath).isDirectory()){
                console.log(fpath, 'is a folder, use rmdir');
            }
            else{
                fs.unlinkSync(fpath);
            }    
        }catch(e){
            /*iin*/console.log('rmFile: ', e.message);
        }
    }
}
module.exports = utils;