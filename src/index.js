var Harvest = require('harvest');
var moment = require('moment');
var async = require('async');
var qs = require('qs');
var debug = require('debug')('revenue-core');
var dbInit = require('./db');

module.exports = function (options, configurator, callback) {
  var clioptions = options;

  debug('options: %j', clioptions);
  return dbInit(configurator).then((db) => {

    const CONFIG = db.get('config').first().value();
    const DATE_FORMAT = 'YYYY-MM-DD HH:mm';
    const MIN_INTERVAL = 30 * 60;

    debug('config: %o', CONFIG);

    var last_update;

    if (db.has('updates').value()) {
      last_update = db.get('updates').first().value().updated_since;
    }

    if (clioptions.force || !db.get('payments').exists()) {
      last_update = undefined;
    }
    debug('last update: %s', last_update);

    var harvest = new Harvest(CONFIG);
    var page = 0;
    var q = async.queue((invoice, done) => getPaymentList(invoice, done), 4);

    var getInvoiceList = (cb) => {
      q.drain = cb;
      page++;

      var query = {
        updated_since: last_update,
        page: page
      };
      debug('Query %o', query);

      harvest.Invoices.list(query, (err, data) => {
        if (err) {
          debug(err);
          return;
        }
        debug('invoices %o', data);
        for (var i = 0; i < data.length; i++) {
          var invoice = data[i].invoices;
          db.get('invoices').upsert(invoice);
          if (invoice.state === 'paid') {
            q.push(invoice);
          }
        };
        debug('getInvoiceList: page %s', page);
        if (data.length) {
          getInvoiceList(cb);
        } else if (!q.length()) {
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
      }, (err, data) => {
        if (err) {
          debug(err);
          done();
          return;
        }
        for (var i = 0; i < data.length; i++) {
          var payment = data[i].payment;
          db.get('payments').upsert(payment);
        };
        done();
      });
    };

    if (!last_update || moment().unix() - moment(last_update, DATE_FORMAT).unix() > MIN_INTERVAL) {
      debug('fetching form server');
      getInvoiceList(() => {
        debug('rendering');
        var now = moment.utc().subtract(10, 'minutes').format(DATE_FORMAT);
        db.get('updates').upsert({
          id: 0,
          updated_since: now
        });
        debug('updated %s', now);
        callback(db, now, clioptions);
      });
    } else {
      debug('rendering');
      callback(db, last_update, clioptions);
    }
  });
};
