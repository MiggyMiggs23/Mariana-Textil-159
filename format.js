const { format } = require('date-fns');
const { es } = require('date-fns/locale');
console.log(format(new Date(), "h:mm a"));
