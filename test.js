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
        zip: 95014,
        door: "10144"
    },
    'avenida brigadeiro faria lima 3064, 3Â° andar  sao paulo  brazil':{
        country: 'br',
        state: 'sao paulo'
    },
    '23 hunter street - 601 level 6, currency house  sydney   2000':{
        country: 'au',
        city: 'sydney',
        door: "23"
    },
    '69 lawrence ln.  bay shore  united states 11706-8623':{
        country: 'us',
        zip: '11706',
        city: 'bay shore',
        door: "69"
    },
    '200 berwyn park 920  berwyn   19312-2405':{
        country: 'us',
        zip: '19312',
        city: 'berwyn',
        state: 'pa',
        door: "200"
    },
    "saint martin's ct. 5th fl.  london  united kingdom ec4m 7ej":{
        country: 'gb',
        zip: 'ec4m 7ej',
        city: 'london',
        street: 'saint martin\'s court fifth floor'
    },
    "4-22 rue marie-georges picquart  paris  france (european territory)":{
        country: 'fr',
        city: 'paris',
        door: "4-22",
        street: 'rue marie georges picquart'
    },
    "new york  new york  usa":{
        country: 'us',
        city: 'new york',
        state: "new york"
    },
    "800 third avenue  new york  usa":{
        country: 'us',
        city: 'new york',
        state: "new york"
    },
    "105 wigmere st.  london  united kingdom w1u 1qj":{
        country: 'gb',
        zip: 'w1u 1qj',
        city: 'london',
        door: '105',
        street: 'wigmere street'
    },
    "midtown tower 9-7-1 akasaka minato-ku (tokyo)   107-6242":{
        country: 'jp',
        zip: '107-6242',
        city: 'minato',
        state:'tokyo',
    },
    "10 sasco hill road  fairfield   06430": {
        country: 'us',
        zip: '06430',
        city: 'fairfield',
        state:'ct',
    },
    "charles-de-gaulle-platz 1  cologne   50679": {
        country: 'de',
        zip: '50679',
        city: 'cologne',
    },
    "shelbourne buildings shelbourne road ballsbridge 4 dublin d04 w3v6":{
        country: 'ie',
        zip: 'd04 w3v6',
        city: 'dublin',
    },
    "101 federal street - 1900  boston  02100": {
        country: 'us',
        zip: '02100',
        city: 'boston',
        state: 'ma'
    },
    "belgielei 49-53, antwerpen  aalter   2018":{
        country: 'be',
        zip: '2018',
        city: 'aalter',
        state: 'vlg'
    },
    "landsvagen 40, sundbyberg  stockholm   105 34":{
        country: 'se',
        zip: '105-34',
        state: 'stockholm',
        city: 'sundbyberg'
    }
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