var Harvest = require('harvest');
var moment = require('moment');
var numeral = require('numeral');
var async = require('async');
var qs = require('qs');
var debug = require('debug')('revenue-core');
var db = require('./db');

module.exports = function(options, configurator, callback){
  var clioptions = options;

  debug('options: %j', clioptions);
  return db(configurator).then((db) => {

    const CONFIG = db('config').first();
    const DATE_FORMAT = 'YYYY-MM-DD HH:mm';
    const MIN_INTERVAL = 30*60;

    debug('config: %o', CONFIG);

    var last_update;

    if (db('updates').exists()) {
      last_update = db('updates').first().updated_since;
    }

    if(clioptions.force || !db('payments').exists()){
      last_update = undefined;
    }
    debug('last update: %s', last_update);

    var harvest = new Harvest(CONFIG);
    var page = 0;
    var q = async.queue((invoice, done)=> getPaymentList(invoice, done), 4);

    var getInvoiceList = (cb) => {
      q.drain = cb;
      page++;

      var query = qs.stringify({
        updated_since: last_update,
        page: page
      }, {
        arrayFormat: 'brackets'
      });

      debug(query);

      harvest.Invoices.list(query, (err, data)=> {
        if (err) {
          debug(err);
          return;
        }
        debug('invoices %o', data);
        for (var i = 0; i < data.length; i++) {
          var invoice = data[i].invoices;
          db('invoices').upsert(invoice);
          if (invoice.state === 'paid') {
            q.push(invoice);
          }
        };
        debug('getInvoiceList: page %s', page);
        if (data.length) {
          getInvoiceList(cb);
        }else if(!q.length()){
          cb();
        }
      });
    };

    var getPaymentList = (invoice, done) => {
      debug('getPaymentsList');
      if (invoice.state !== 'paid') {
        return;
      }
      harvest.InvoicePayments.paymentsByInvoice({
        invoice_id: invoice.id
      }, (err, data)=>{
        if (err) {
          debug(err);
          done();
          return;
        }
        for (var i = 0; i < data.length; i++) {
          var payment = data[i].payment;
          db('payments').upsert(payment);
        };
        done();
      });
    };

    if (!last_update || moment().unix() - moment(last_update, DATE_FORMAT).unix() > MIN_INTERVAL) {
      debug('fetching form server');
      getInvoiceList(()=>{
        debug('rendering');
        var now = moment.utc().format(DATE_FORMAT);
        db('updates').upsert({id:0, updated_since: now});
        debug('updated %s', now);
        callback(db, now, clioptions);
      });
    }else{
      debug('rendering');
      callback(db, last_update, clioptions);
    }
  });
};
