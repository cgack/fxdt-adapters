'use strict';const BufferSize=1024;var libc=null;var libcFunc={};var pollfd=new ctypes.StructType("pollfd",[{'fd':ctypes.int},{'events':ctypes.short},{'revents':ctypes.short}]);var WriteBuffer=ctypes.uint8_t.array(BufferSize);var ReadBuffer=ctypes.char.array(BufferSize);const POLLIN=0x0001;const POLLOUT=0x0004;const POLLERR=0x0008;const POLLHUP=0x0010;const POLLNVAL=0x0020;const WNOHANG=0x01;const pid_t=ctypes.int32_t;const INDEFINITE=-1;const NOWAIT=0;const WAITTIME=200
function initLibc(libName){postMessage({msg:"debug",data:"initialising library with "+libName});libc=ctypes.open(libName);libcFunc.pollFds=pollfd.array(1);libcFunc.poll=libc.declare("poll",ctypes.default_abi,ctypes.int,libcFunc.pollFds,ctypes.unsigned_int,ctypes.int);
 libcFunc.write=libc.declare("write",ctypes.default_abi,ctypes.int,ctypes.int,WriteBuffer,ctypes.int);libcFunc.read=libc.declare("read",ctypes.default_abi,ctypes.int,ctypes.int,ReadBuffer,ctypes.int);libcFunc.pipefd=ctypes.int.array(2);libcFunc.close=libc.declare("close",ctypes.default_abi,ctypes.int,ctypes.int);libcFunc.waitpid=libc.declare("waitpid",ctypes.default_abi,pid_t,pid_t,ctypes.int.ptr,ctypes.int);}
function closePipe(pipe){libcFunc.close(pipe);}
function writePipe(pipe,data){postMessage({msg:"debug",data:"trying to write to "+pipe});let numChunks=Math.floor(data.length/BufferSize);let pData=new WriteBuffer();for(var chunk=0;chunk<=numChunks;chunk++){let numBytes=chunk<numChunks?BufferSize:data.length-chunk*BufferSize;for(var i=0;i<numBytes;i++){pData[i]=data.charCodeAt(chunk*BufferSize+i)%256;}
let bytesWritten=libcFunc.write(pipe,pData,numBytes);if(bytesWritten!=numBytes){closePipe(pipe);postMessage({msg:"error",data:"error: wrote "+bytesWritten+" instead of "+numBytes+" bytes"});close();}}
postMessage({msg:"info",data:"wrote "+data.length+" bytes of data"});}
function readString(data,length,charset){var string='',bytes=[];for(var i=0;i<length;i++){if(data[i]==0&&charset!="null") 
break;bytes.push(data[i]);}
return bytes;}
function readPipe(pipe,charset,pid){var p=new libcFunc.pollFds;p[0].fd=pipe;p[0].events=POLLIN|POLLERR|POLLHUP;p[0].revents=0;var pollTimeout=WAITTIME;var exitCode=-1;var readCount=0;var result,status=ctypes.int();result=0;const i=0;while(true){if(result==0){result=libcFunc.waitpid(pid,status.address(),WNOHANG);if(result>0){pollTimeout=NOWAIT;exitCode=parseInt(status.value);postMessage({msg:"debug",data:"waitpid signaled subprocess stop, exitcode="+status.value});}}
var r=libcFunc.poll(p,1,pollTimeout);if(r>0){if(p[i].revents&POLLIN){postMessage({msg:"debug",data:"reading next chunk"});readCount=readPolledFd(p[i].fd,charset);if(readCount==0)break;}
if(p[i].revents&POLLHUP){postMessage({msg:"debug",data:"poll returned HUP"});break;}
else if(p[i].revents&POLLERR){postMessage({msg:"error",data:"poll returned error"});break;}
else if(p[i].revents!=POLLIN){postMessage({msg:"error",data:"poll returned "+p[i]});break;}}
else
if(pollTimeout==0||r<0)break;} 
while(readCount>0){readCount=readPolledFd(pipe,charset);}
libcFunc.close(pipe);postMessage({msg:"done",data:exitCode});libc.close();close();}
function readPolledFd(pipe,charset){var line=new ReadBuffer();var r=libcFunc.read(pipe,line,BufferSize);if(r>0){var c=readString(line,r,charset);postMessage({msg:"data",data:c,count:c.length});}
return r;}
onmessage=function(event){switch(event.data.msg){case"init":initLibc(event.data.libc);break;case"read":initLibc(event.data.libc);readPipe(event.data.pipe,event.data.charset,event.data.pid);break;case"write":
 writePipe(event.data.pipe,event.data.data);postMessage({msg:"info",data:"WriteOK"});break;case"close":postMessage({msg:"debug",data:"closing stdin\n"});closePipe(event.data.pipe);postMessage({msg:"info",data:"ClosedOK"});break;case"stop":libc.close(); close();break;default:throw("error: Unknown command"+event.data.msg+"\n");}
return;};