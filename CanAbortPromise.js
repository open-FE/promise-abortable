function getAbortController() {
    var abortSignal = getAbortSignal();
    var abort = function (reason) {
        if (abortSignal.aborted) {
            return;
        }
        abortSignal.aborted = true;
        abortSignal.dispatchEvent(reason); // Different from AbortSignal
    };
    return {
        signal: abortSignal,
        abort: abort,
    };
}

function getAbortSignal() {
    var abortSignal = {
        aborted: false,
        onabort: null,
    };
    abortSignal.dispatchEvent = function (event) {
        if ('function' === typeof abortSignal.onabort) {
            abortSignal.onabort(event);
        }
    };
    return abortSignal;
}

function setPromisesAbort(promises, signal) {
    signal.onabort = (reason) => {
        promises.forEach((promise) => {
            if (promise instanceof CanAbortPromise) {
                promise.abort(reason).catch((error) => error);
            }
        });
    };
}

class CanAbortPromise extends Promise {
    constructor(executor, abortController = getAbortController()) {
        super((resolve, reject) => {
            // abortController.signal = reject;
            executor(resolve, reject, abortController.signal);
        });
        this.abortController = abortController;
    }

    then(onFulfilled, onRejected) {
        return new CanAbortPromise((resolve, reject, signal) => {
            const onSettled = (status, value, callback) => {
                if ('function' === typeof callback) {
                    value = callback(value);
                    if (value instanceof CanAbortPromise) {
                        Object.assign(signal, value.abortController.signal);
                    }
                    return resolve(value);
                }
                'resolved' === status && resolve(value);
                'rejected' === status && reject(value);
            };
            super.then(
                (value) => onSettled('resolved', value, onFulfilled),
                (reason) => onSettled('rejected', reason, onRejected),
            );
        }, this.abortController);
    }

    abort(reason) {
        return new CanAbortPromise((resolve, reject) => {
            Promise.resolve().then(() => {
                this.abortController.abort(reason);
                this.then(resolve, reject);
            });
        }, this.abortController);
    }

    static all(promises) {
        return new CanAbortPromise((resolve, reject, signal) => {
            setPromisesAbort(promises, signal);
            Promise.all(promises).then(resolve, reject);
        });
    }

    static race(promises) {
        return new CanAbortPromise((resolve, reject, signal) => {
            setPromisesAbort(promises, signal);
            Promise.race(promises).then(resolve, reject);
        });
    }
}


/*
   测试
*/

function Test(obj, timer) {
    return new CanAbortPromise((resolve, reject, signal) => {
        signal.onabort = reject;

        // signal.onabort= function(a){
        //     reject({})
        //     console.log('---- onabort',a);
        // }

        setTimeout(() => {
            console.dir('接口返回来了');
            resolve(obj);
        }, timer);
    });
}

const a = Test(
    {
        a: 100,
        b: 200,
    },
    1000,
);
a.then((a) => {
    console.log('----1', a);
}).catch((b) => {
    console.log('----2', b);
});

a.abort('Promise a被abort掉');

const b = Test({
    a: 300,
    b: 400
}, 500);

b.then((a) => {
    console.log('----3', a);
}).catch(b => {
    console.log('----4', b);
});
