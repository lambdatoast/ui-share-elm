// ResponseHandler = (M[A,Response] -> B)
// Request = { method:String, url:String, data:{}, responseHandler:ResponseHandler }
// String -> String -> {} -> ResponseHandler -> Request
function Request(method, url, data, responseHandler) {
  return { method: method, url: url, data: data, responseHandler: responseHandler || (function () { }) }
}
Request.POST = "post"
Request.GET = "get"

// {} -> Response
function Response(data) {
  return data
}

// StoreRequest = { category:String, sourcecode:String }
// String -> String -> StoreRequest
function StoreRequest(category, sourcecode ) {
  return {
    category: category,
    sourcecode: sourcecode
  }
}

module.exports = {
  Response: Response,
  Request: Request,
  StoreRequest: StoreRequest
}
