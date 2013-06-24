
/*
 * 主页.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Express' });
};