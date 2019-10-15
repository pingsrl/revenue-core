const debug = require('debug')('revenue-core');

const getPaymentList = (harvest, db, invoice, done) => {
	debug('getPaymentsList');
	if (invoice.state !== 'paid') {
		return;
	}
	harvest.invoicePayments
		.list(invoice.id)
		.then(data => {
			data.invoice_payments.map(payment => {
				debug('Payments %o', payment);
				db.get('payments')
					.upsert(payment)
					.write();
			});
			done();
		})
		.catch(err => {
			debug(err);
			done();
		});
};

module.exports = getPaymentList;
