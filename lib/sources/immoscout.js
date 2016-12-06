const notify = require('../notify');
const config = require('../config');
const xray = require('../scraper');
const Store = require('../store');

class Immoscout {

  constructor() {
    this._store = new Store('immoscout');
    this._fullCrawl = true;
  }

  run() {
    return this._getImmoscoutListings(config.urlImmoscout())
      .then(this._filter)
      .then(this._findNew.bind(this))
      .then(this._updateKnownListings.bind(this))
      .then(this._notify)
  }

  _getImmoscoutListings(url) {
    return new Promise((resolve, reject) => {
      let x = xray(url, '#resultListItems li.result-list__listing', [{
        id: '.result-list-entry@data-obid | int',
        price: '.result-list-entry .result-list-entry__criteria .grid-item:first-child dd | removeNewline | trim',
        size: '.result-list-entry .result-list-entry__criteria .grid-item:nth-child(2) dd | removeNewline | trim',
        title: '.result-list-entry .result-list-entry__brand-title-container h5 | removeNewline | trim',
        link: '.result-list-entry .result-list-entry__brand-title-container@href',
        address: '.result-list-entry .result-list-entry__address span'
      }]);

      if (this._fullCrawl) {
        this._fullCrawl = false;
        x = x.paginate('#pager .align-right a@href');
      }

      x((err, listings) => {
        if (err) reject(err);
        resolve(listings);
      })
    })
  }

  _filter(listings) {
    return listings.filter(o => {
      const notBlacklisted = !(new RegExp(String.raw `\b(${config.blacklist.join("|")})\b`, 'ig').test(o.title));

      return notBlacklisted;
    })
  }

  _findNew(listings) {
    return listings
      .map(l => l.id)
      .filter(id => this._store.knownListings.indexOf(id) < 0)
      .map(id => listings.find(l => l.id === id));

  }

  _updateKnownListings(newListings) {
    if (newListings.length > 0) {
      this._store.knownListings = [...this._store.knownListings, ...(newListings.map(l => l.id))];
    }

    return newListings;
  }

  _notify(newListings) {
    if (newListings.length === 0) return;

    console.log(newListings.map(l => l.title).join("\n"));
    console.log(`-- Found ${newListings.length} new listing(s) --`);

    newListings.forEach(o => {
      notify.send(
        `*${o.title.replace('NEU', '').replace(/\*/g, '')}*\n${o.address.replace(/\(.*\),.*$/, '')} | ${o.price} [|](${o.link}) ${o.size}`
      )
    });
  }

}

module.exports = new Immoscout();