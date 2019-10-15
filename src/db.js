const fs = require('fs');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const debug = require('debug')('revenue-core');

const home_dir = path.resolve(
	process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME']
);

const filename = '.revenue_config';

const adapter = new FileSync(`${home_dir}/${filename}`);
const db = low(adapter);

db.defaults({
	config: [],
	updates: [],
	invoices: [],
	payments: []
});

db._.mixin({
	upsert: function(collection, obj = {}, key = 'id') {
		for (var i = 0; i < collection.length; i++) {
			var el = collection[i];
			if (el[key] === obj[key]) {
				collection[i] = obj;
				return collection;
			}
		}
		collection.push(obj);
	},
	exists: function(collection) {
		return collection && collection.length > 0;
	}
});

module.exports = configurator => {
	return new Promise((ok, fail) => {
		// Do I have a config file ?
		fs.access(home_dir + '/' + filename, fs.R_OK, err => {
			err ? fail() : ok();
		});
	})
		.then(() => {
			// Does the configuration exists ?
			return db;
		})
		.then(db => {
			// Does the configuration exists ?
			return configurator(db);
		})
		.then(config => {
			config.id = 0;
			db.get('config').upsert(config);

			return db;
		})
		.catch(err => {
			console.log(err);
		});
};
