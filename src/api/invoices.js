const async = require('async').default;
const getPaymentList = require('./payments');
const debug = require('debug')('revenue-core');

let CONCURRENCY = 2;
let QUEUE;
let page = 0;

const getInvoiceList = function(harvest, db, last_update, done) {
	if (QUEUE == undefined) {
		QUEUE = async.queue(
			(invoice, done) => getPaymentList(harvest, db, invoice, done),
			CONCURRENCY
		);
		page = 0;
	}

	QUEUE.drain(done);
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
				getInvoiceList(harvest, db, done);
			} else if (QUEUE.length() === 0) {
				done();
			}
		})
		.catch(err => {
			console.error(err);
		});
};

module.exports = getInvoiceList;
