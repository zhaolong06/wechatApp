export const Test = {
    a: 'A',
};

export async function getName() {
    const promise = Promise.resolve(10);
    let value = 0;
    await promise.then((item) => { value = item; });
    return value;
}
