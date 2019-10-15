const async = require('async').default;
const getPaymentList = require('./payments');
const debug = require('debug')('revenue-core');

let QUEUE;
let page = 0;

const getInvoiceList = function(harvest, db, last_update, cb) {
	if (QUEUE == undefined) {
		QUEUE = async.queue(
			(invoice, done) => getPaymentList(harvest, db, invoice, done),
			4
		);
		page = 0;
	}
	QUEUE.drain(cb);
	page++;

	var query = {
		updated_since: last_update,
		page: page
	};
	debug('Query %o', query);

	harvest.invoices
		.list(query)
		.then(data => {
			debug('invoices %o', data);
			data.invoices.map(invoice => {
				db.get('invoices')
					.upsert(invoice)
					.write();
				if (invoice.state === 'paid') {
					QUEUE.push(invoice);
				}
			});
			debug('getInvoiceList: page %s', page);
			if (data.next_page) {
				getInvoiceList(harvest, db, cb);
			}
		})
		.catch(err => {
			debug(err);
		});
};

module.exports = getInvoiceList;
