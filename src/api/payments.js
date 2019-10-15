const debug = require('debug')('revenue-core');

const getPaymentList = (harvest, db, invoice, done) => {
	debug('getPaymentsList');
	if (invoice.state !== 'paid') {
		done();
		return;
	}

	harvest.invoicePayments
		.list(invoice.id)
		.then(data => {
			debug('Payments %o', data.invoice_payments);
			data.invoice_payments.map(payment => {
				db.get('payments')
					.upsert(payment)
					.write();
			});
			done();
		})
		.catch(err => {
			console.error(err);
			done();
		});
};

module.exports = getPaymentList;
