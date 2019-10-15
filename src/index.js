const Harvest = require('harvest').default;
const async = require('async').default;
const moment = require('moment');
const qs = require('qs');
const debug = require('debug')('revenue-core');
const dbInit = require('./db');
const getInvoicesList = require('./api/invoices');

module.exports = function(options, configurator, callback) {
	var clioptions = options;

	debug('options: %j', clioptions);
	return dbInit(configurator).then(db => {
		const CONFIG = db
			.get('config')
			.first()
			.value();

		const DATE_FORMAT = 'YYYY-DD-MM HH:mm:ss';
		const MIN_INTERVAL = 30 * 60;
		debug('config: %o', CONFIG);
		const harvest = new Harvest(CONFIG);

		let last_update;

		if (db.has('updates').value()) {
			const update = db
				.get('updates')
				.first()
				.value();
			if (update) {
				last_update = update.updated_since;
			}
		}

		if (clioptions.force || clioptions.year || !db.get('payments').exists()) {
			last_update = undefined;
		}
		debug('last update: %s', last_update);

		if (
			!last_update ||
			moment().unix() - moment(last_update).unix() > MIN_INTERVAL
		) {
			debug('fetching form server');
			getInvoicesList(harvest, db, last_update, () => {
				debug('rendering');
				var now = moment
					.utc()
					.subtract(10, 'minutes')
					.toISOString();

				db.get('updates')
					.upsert({
						id: 0,
						updated_since: now
					})
					.write();
				debug('updated %s', now);
				callback(db, now, clioptions);
			});
		} else {
			debug('rendering');
			callback(db, last_update, clioptions);
		}
	});
};
