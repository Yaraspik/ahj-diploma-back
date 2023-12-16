const getId = function getIdDecorator() {
  let count = 20;

  function upId() {
    count += 1;
    return count;
  }

  return upId;
};

export default getId();
