const axios = require("axios");

class DockerAPI {

    repository(user, name) {
        user = user.toLowerCase();

        let path = `/v2/repositories/${user}/${name}`;

        return this.request(path);
    }

    tags(user, name) {
        user = user.toLowerCase();

        let path = `/v2/repositories/${user}/${name}/tags`;

        return this.requestAllPages(path);
    }

    requestAllPages(path) {
        let pageSize = 100;

        return new Promise((resolve, reject) => {
            this.request(path, 1, pageSize).then((firstPageResult) => {
                let totalElementCount = firstPageResult.count;
                let maxPage = Math.ceil(totalElementCount / pageSize);

                var promises = [];

                for(let i = 2; i <= maxPage; i++) {
                    promises.push(this.request(path, i, pageSize));
                }

                Promise.all(promises).then((subsequentResults) => {
                    subsequentResults.push(firstPageResult);
                    // Extract the results from each of the requests
                    let elementArray = subsequentResults.flatMap((result) => result.results);

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
        let url = `https://hub.docker.com${path}`
        
        if(page && pageSize) {
            url += `?page_size=${pageSize}&page=${page}`
        }

        return axios({
            method: "GET",
            url: url
        }).then((res) => res.data);
    }

}

module.exports = { DockerAPI: DockerAPI };