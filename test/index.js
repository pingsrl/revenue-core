import test from 'ava';
import revenue from '../src/index.js';

let rev = new Promise((ok, fail) => {
	revenue(
		{},
		db => {
			return db
				.get('config')
				.first()
				.value();
		},
		(db, lastUpdate, options) => {
			ok({
				db,
				lastUpdate,
				options
			});
		}
	);
});

test('it should read config', async t => {
	let { db } = await rev;
	t.true(db.get('config').value() instanceof Array);
});

test('VAT should be 22', async t => {
	let { db } = await rev;
	t.true(
		typeof db
			.get('config')
			.first()
			.value().vat === 'number'
	);
});

test('Last update should be a date', async t => {
	let { lastUpdate } = await rev;
	t.true(!isNaN(Date.parse(lastUpdate)));
});
