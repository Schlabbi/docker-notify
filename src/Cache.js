const fs = require('fs');

let cachePath = "./cache/cache.json";

class Cache {

    static getCache() {
        return new Promise((resolve, reject) => {
            fs.readFile(cachePath, 'utf8', (err, data) => {
                if(err) {
                    if(err.code == 'ENOENT') {
                        //cache does not exist, create it
                        fs.writeFile(cachePath, "{}", 'utf8', (err) => {
                            if(err) {
                                reject(err);
                            } else {
                                resolve({});
                            }
                        });
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(JSON.parse(data));                }
            });
        });
    }

    static writeCache(cache) {
        return new Promise((resolve, reject) => {
            fs.writeFile(cachePath, cache, 'utf8', (err) => {
                if(err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

}

module.exports = Cache;