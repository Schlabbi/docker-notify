const axios = require('axios');

class DockerAPI {

    repository(user, name) {
        user = user.toLowerCase();

        const path = `/v2/repositories/${user}/${name}`;

        return this.request(path);
    }

    tags(user, name) {
        user = user.toLowerCase();

        const path = `/v2/repositories/${user}/${name}/tags`;

        return this.requestAllPages(path);
    }

    requestAllPages(path) {
        const pageSize = 100;

        return new Promise((resolve, reject) => {
            this.request(path, 1, pageSize).then((firstPageResult) => {
                const totalElementCount = firstPageResult.count;
                const maxPage = Math.ceil(totalElementCount / pageSize);

                const promises = [];

                for (let i = 2; i <= maxPage; i++) {
                    promises.push(this.request(path, i, pageSize));
                }

                Promise.all(promises).then((subsequentResults) => {
                    subsequentResults.push(firstPageResult);
                    // Extract the results from each of the requests
                    const elementArray = subsequentResults.flatMap((result) => result.results);

                    resolve(elementArray);
                }).catch((error) => {
                    reject(error);
                });
            }).catch((error) => {
                reject(error);
            });
        });
    }

    request(path, page, pageSize) {
        let url = `https://hub.docker.com${path}`;

        if (page && pageSize) {
            url += `?page_size=${pageSize}&page=${page}`;
        }

        return axios({
            method: 'GET',
            url: url
        }).then((res) => res.data);
    }

}

module.exports = { DockerAPI: DockerAPI };
