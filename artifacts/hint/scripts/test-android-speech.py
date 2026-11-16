"""Run the actual Android speech plugin against deterministic JVM platform doubles.

Requires a JDK (JAVA_HOME or javac on PATH); no SDK, microphone, network or provider.
This checks the bridge protocol and lifecycle, not Android service/device behavior.
"""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[1] / "android/app/src/main/java/com/mydailyhint/app/HintSpeechRecognitionPlugin.java")
args = parser.parse_args()
java_home = os.environ.get("JAVA_HOME")
suffix = ".exe" if os.name == "nt" else ""
javac = str(Path(java_home) / "bin" / ("javac" + suffix)) if java_home else shutil.which("javac")
java = str(Path(javac).with_name("java" + suffix)) if javac else None
if not javac:
    raise SystemExit("A JDK is required: set JAVA_HOME or add javac to PATH.")

sources = {
"android/Manifest.java": 'package android; public class Manifest { public static class permission { public static final String RECORD_AUDIO="record"; } }',
"android/content/Context.java": 'package android.content; public class Context { public String getPackageName(){ return "fixture"; } }',
"android/content/Intent.java": '''package android.content; import java.util.*; public class Intent {
 public final Map<String,Object> extras=new HashMap<>(); public Intent(String action){} public void putExtra(String k,Object v){ extras.put(k,v); }
}''',
"android/os/Bundle.java": '''package android.os; import java.util.*; public class Bundle {
 private final Map<String,ArrayList<String>> values=new HashMap<>();
 public ArrayList<String> getStringArrayList(String k){ return values.get(k); }
 public void putStringArrayList(String k,ArrayList<String> v){ values.put(k,v); }
}''',
"android/os/Looper.java": 'package android.os; public class Looper { public static Looper getMainLooper(){return new Looper();} }',
"android/os/Handler.java": '''package android.os; import java.util.*; public class Handler {
 static final List<Runnable> immediate=new ArrayList<>(), delayed=new ArrayList<>(); public Handler(Looper l){}
 public boolean post(Runnable r){immediate.add(r);return true;} public boolean postDelayed(Runnable r,long ms){delayed.add(r);return true;}
 public void removeCallbacks(Runnable r){immediate.remove(r);delayed.remove(r);}
 public static void drain(){while(!immediate.isEmpty()) immediate.remove(0).run();}
 public static void expire(){for(Runnable r:new ArrayList<>(delayed)){delayed.remove(r);r.run();}drain();}
}''',
"android/speech/RecognizerIntent.java": '''package android.speech; public class RecognizerIntent {
 public static final String ACTION_RECOGNIZE_SPEECH="recognize", EXTRA_LANGUAGE_MODEL="model", LANGUAGE_MODEL_FREE_FORM="free", EXTRA_LANGUAGE="language", EXTRA_PARTIAL_RESULTS="partial", EXTRA_MAX_RESULTS="max", EXTRA_CALLING_PACKAGE="package";
}''',
"android/speech/RecognitionListener.java": '''package android.speech; import android.os.Bundle; public interface RecognitionListener {
 void onReadyForSpeech(Bundle b); void onBeginningOfSpeech(); void onRmsChanged(float f); void onBufferReceived(byte[] b); void onEndOfSpeech(); void onError(int e); void onResults(Bundle b); void onPartialResults(Bundle b); void onEvent(int e,Bundle b);
}''',
"android/speech/SpeechRecognizer.java": '''package android.speech; import android.content.*; import java.util.*; public class SpeechRecognizer {
 public static final int ERROR_AUDIO=1, ERROR_INSUFFICIENT_PERMISSIONS=2, ERROR_NETWORK=3, ERROR_NETWORK_TIMEOUT=4, ERROR_RECOGNIZER_BUSY=5, ERROR_SERVER=6, ERROR_NO_MATCH=7, ERROR_SPEECH_TIMEOUT=8;
 public static final String RESULTS_RECOGNITION="results"; public static final List<SpeechRecognizer> instances=new ArrayList<>();
 public RecognitionListener listener; public Intent intent; public int stopped,cancelled,destroyed; public boolean stopThrows;
 public static boolean isRecognitionAvailable(Context c){return true;}
 public static SpeechRecognizer createSpeechRecognizer(Context c){SpeechRecognizer r=new SpeechRecognizer();instances.add(r);return r;}
 public void setRecognitionListener(RecognitionListener l){listener=l;} public void startListening(Intent i){intent=i;}
 public void stopListening(){stopped++;if(stopThrows)throw new IllegalStateException("fixture");}
 public void cancel(){cancelled++;} public void destroy(){destroyed++;}
 public static SpeechRecognizer latest(){return instances.get(instances.size()-1);}
}''',
"com/getcapacitor/JSObject.java": 'package com.getcapacitor; public class JSObject extends java.util.LinkedHashMap<String,Object> {}',
"com/getcapacitor/JSArray.java": 'package com.getcapacitor; public class JSArray extends java.util.ArrayList<Object> { public void put(Object v){add(v);} }',
"com/getcapacitor/PermissionState.java": 'package com.getcapacitor; public enum PermissionState { GRANTED, DENIED }',
"com/getcapacitor/PluginCall.java": '''package com.getcapacitor; import java.util.*; public class PluginCall {
 public final Map<String,String> data=new HashMap<>(); public boolean resolved; public String error;
 public PluginCall(String id){if(id!=null)data.put("sessionId",id);data.put("language","ja-JP");}
 public String getString(String k){return data.get(k);} public String getString(String k,String fallback){return data.getOrDefault(k,fallback);}
 public void resolve(){resolved=true;} public void resolve(JSObject o){resolved=true;}
 public void reject(String s){error=s;} public void reject(String s,Exception e){error=s;}
}''',
"com/getcapacitor/Plugin.java": '''package com.getcapacitor; import android.content.Context; import java.util.*; public class Plugin {
 public final List<JSObject> events=new ArrayList<>(); public PermissionState permission=PermissionState.GRANTED;
 public Context getContext(){return new Context();} public PermissionState getPermissionState(String p){return permission;}
 public void requestPermissions(PluginCall c){} public void requestPermissionForAlias(String a,PluginCall c,String method){}
 public void notifyListeners(String name,JSObject data){JSObject event=new JSObject();event.putAll(data);event.put("event",name);events.add(event);}
 protected void handleOnPause(){} protected void handleOnDestroy(){}
}''',
"com/getcapacitor/PluginMethod.java": 'package com.getcapacitor; public @interface PluginMethod {}',
"com/getcapacitor/annotation/CapacitorPlugin.java": 'package com.getcapacitor.annotation; public @interface CapacitorPlugin { String name(); Permission[] permissions(); }',
"com/getcapacitor/annotation/Permission.java": 'package com.getcapacitor.annotation; public @interface Permission { String alias(); String[] strings(); }',
"com/getcapacitor/annotation/PermissionCallback.java": 'package com.getcapacitor.annotation; public @interface PermissionCallback {}',
"com/mydailyhint/app/SpeechContractTest.java": '''package com.mydailyhint.app;
import android.os.*; import android.speech.*; import com.getcapacitor.*; import java.util.*;
public class SpeechContractTest {
 static int checks=0;
 static void check(boolean ok,String message){checks++;if(!ok)throw new AssertionError(message);}
 static PluginCall call(String id){return new PluginCall(id);}
 static SpeechRecognizer start(HintSpeechRecognitionPlugin p,String id){PluginCall c=call(id);p.start(c);Handler.drain();check(c.resolved,"start resolves");return SpeechRecognizer.latest();}
 static Bundle words(String text){Bundle b=new Bundle();b.putStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION,new ArrayList<>(List.of(text)));return b;}
 static long count(HintSpeechRecognitionPlugin p,String name){return p.events.stream().filter(e->name.equals(e.get("event"))).count();}
 static void tagged(HintSpeechRecognitionPlugin p,String id){for(JSObject e:p.events)check(id.equals(e.get("sessionId")),"every event must carry the client session ID: "+e);}
 public static void main(String[] args){
  HintSpeechRecognitionPlugin p=new HintSpeechRecognitionPlugin();
  SpeechRecognizer a=start(p,"first");
  check("ja-JP".equals(a.intent.extras.get(RecognizerIntent.EXTRA_LANGUAGE)),"native language forwarded");
  a.listener.onPartialResults(words("Almost")); tagged(p,"first");
  p.stop(call("first"));p.stop(call("first"));Handler.drain();
  check(a.stopped==1 && a.cancelled==0,"Stop flushes once and does not cancel");
  check(count(p,"partialResults")==1,"Stop waits for final words");
  a.listener.onResults(words("Almost finished"));
  tagged(p,"first");check(count(p,"partialResults")==2,"final words delivered after Stop");
  check(p.events.stream().anyMatch(e->Boolean.TRUE.equals(e.get("isFinal"))),"final result marked");
  check(a.destroyed==1,"final result releases recognizer");
  int ended=p.events.size();Handler.expire();check(p.events.size()==ended,"final result cancels timeout");
  p.events.clear();SpeechRecognizer b=start(p,"second");
  p.stop(call("first"));p.cancel(call("first"));Handler.drain();
  check(b.stopped==0 && b.cancelled==0,"old commands cannot stop a new session");
  a.listener.onResults(words("late"));a.listener.onError(SpeechRecognizer.ERROR_NETWORK);
  check(count(p,"partialResults")==0 && count(p,"speechError")==0,"old callbacks ignored");
  p.cancel(call("second"));Handler.drain();b.listener.onResults(words("discard"));
  check(b.cancelled==1 && b.destroyed==1,"Cancel releases immediately");
  check(count(p,"partialResults")==0,"Cancel drops final words");tagged(p,"second");
  p.events.clear();SpeechRecognizer c=start(p,"third");p.stop(call("third"));Handler.drain();Handler.expire();
  check(c.cancelled==1 && c.destroyed==1,"missing final result has bounded cleanup");
  tagged(p,"third");
  p.events.clear();SpeechRecognizer d=start(p,"fourth");d.listener.onError(SpeechRecognizer.ERROR_NETWORK);
  check(count(p,"speechError")==1,"native service error emitted");tagged(p,"fourth");check(d.destroyed==1,"error releases recognizer");
  p.events.clear();SpeechRecognizer e=start(p,"fifth");p.handleOnPause();Handler.drain();
  check(e.cancelled==1 && e.destroyed==1,"background releases microphone");tagged(p,"fifth");
  SpeechRecognizer f=start(p,"sixth");f.stopThrows=true;PluginCall stop=call("sixth");p.stop(stop);Handler.drain();
  check(stop.error!=null && f.destroyed==1,"stop failure rejects and releases");
  p.permission=PermissionState.DENIED;int before=SpeechRecognizer.instances.size();PluginCall denied=call("denied");p.start(denied);Handler.drain();
  check(denied.error!=null && SpeechRecognizer.instances.size()==before,"denied permission never starts recognition");
  System.out.println("PASS: Android speech bridge, "+checks+" assertions (JVM platform doubles; no device)");
 }
}''',
}

with tempfile.TemporaryDirectory(prefix="hint-android-speech-") as directory:
    root = Path(directory)
    for name, content in sources.items():
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    plugin = root / "com/mydailyhint/app/HintSpeechRecognitionPlugin.java"
    shutil.copyfile(args.source, plugin)
    classes = root / "classes"
    subprocess.run([javac, "-encoding", "UTF-8", "-d", str(classes), *map(str, root.rglob("*.java"))], check=True)
    subprocess.run([java, "-cp", str(classes), "com.mydailyhint.app.SpeechContractTest"], check=True)
