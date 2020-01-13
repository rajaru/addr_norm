var addrnorm = require('./index');

var cases = {
    '' : {},
    '12921 Coyote Run Fishers IN 46038':{
        country: 'us',
        city: 'fishers',
        state: 'in',
        zip: 46038
    },
    '10144 Potters Hatch Common Cupertino CA 95014': {
        country: 'us',
        city: 'cupertino',
        state: 'ca',
        zip: 95014
    },
    'avenida brigadeiro faria lima 3064, 3Â° andar  sao paulo  brazil':{
        country: 'br',
        city: 'andar',
        state: 'sao paulo'
    },
    '23 hunter street - 601 level 6, currency house  sydney   2000':{
        country: 'au',
        city: 'sydney',
    },
    '69 lawrence ln.  bay shore  united states 11706-8623':{
        country: 'us',
        zip: '11706-8623',
        city: 'bay shore'
    },
    '200 berwyn park 920  berwyn   19312-2405':{
        country: 'us',
        zip: '19312-2405',
        city: 'berwyn',
        state: 'il'
    },

};

var count = 0, err=0;
for(var cas in cases ){
    var ret = addrnorm.normalize(cas);
    var failed = false;
    for(var key in cases[cas] ){
        if( ret[key] != cases[cas][key] ){
            if( !failed )console.log(cas);
            console.log('    ', key+':', ret[key], '!=', cases[cas][key]);
            failed = true;
        }
    }
    err += failed ? 1 : 0;
    count ++;
}
console.log(err+' failed out of '+count);