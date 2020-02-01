
const states = {
    'c': 'buenos aries',
    'b': 'buenos aries',
    'k': 'catamarca',
    'h': 'chaco',
    'u': 'chubut',
    'x': 'cordoba',
    'w': 'corentes',
    'e': 'entr rios',
    'p': 'formosa',
    'y': 'jujuy',
    'l': 'la pampa',
    'f': 'la rioja',
    'm': 'mendoza',
    'n': 'misiones',
    'q': 'neuquen',
    'r': 'rio negro',
    'a': 'salta',
    'j': 'san juan',
    'd': 'san luis',
    'z': 'santa cruz',
    's': 'santa fe',
    'g': 'santiago del estero',
    'v': 'tierra del fuego',
    't': 'tucuman',
};

module.exports = function(zip){
    var matches = zip.trim().match(/^([a-z])(\d\d\d\d)(\s*[a-z][a-z][a-z])?$/im);
    if( !matches )return null;
    if( !states[matches[1]] )return null;
    //return 'ar,'+states[matches[1]];
    return ['ar'];
}