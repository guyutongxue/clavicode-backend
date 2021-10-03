#include <node.h>
#include <v8.h>

#include <type_traits>

#include "config.h"

using v8::Exception, v8::FunctionCallbackInfo, v8::Isolate, v8::Context,
    v8::Local, v8::Number, v8::Object, v8::String, v8::Value;

namespace {

std::string v8ToCxx(Isolate* isolate, Local<String> value) {
  String::Utf8Value utf8(isolate, value);
  return std::string(*utf8, utf8.length());
}

std::int64_t v8ToCxx(Isolate* isolate, Local<v8::Number> value) {
  return value->IntegerValue(isolate->GetCurrentContext()).FromJust();
}

std::vector<std::string> v8ToCxx(Isolate* isolate, Local<v8::Array> value) {
  auto context{isolate->GetCurrentContext()};
  auto size{value->Length()};
  std::vector<std::string> result;
  for (auto i{0u}; i < size; i++) {
    auto ele{value->Get(context, i).ToLocalChecked()};
    if (!ele->IsString()) {
      isolate->ThrowException(Exception::TypeError(
          String::NewFromUtf8(isolate, "Wrong type of arguments")
              .ToLocalChecked()));
      return {};
    }
    result.emplace_back(v8ToCxx(isolate, ele.As<String>()));
  }
  return result;
}

template <typename T>
struct V8Value;

template <>
struct V8Value<std::string> {
  using type = v8::String;
  constexpr static bool (Value::*guard)() const {&Value::IsString};
};

template <>
struct V8Value<std::int64_t> {
  using type = v8::Number;
  constexpr static bool (Value::*guard)() const {&Value::IsNumber};
};

template <>
struct V8Value<std::vector<std::string>> {
  using type = v8::Array;
  constexpr static bool (Value::*guard)() const {&Value::IsArray};
};

template <typename T>
using V8ValueType = typename V8Value<T>::type;

template <typename T>
bool (Value::*v8ValueTypeGuard)() const {V8Value<T>::guard};

template <typename T>
T getPropertyFromObject(Isolate* isolate, const Local<Object>& object,
                        const char* propertyName, const T& defaultValue = T{}) {
  static_assert(std::is_same_v<T, std::string> ||
                    std::is_same_v<T, std::int64_t> ||
                    std::is_same_v<T, std::vector<std::string>>,
                "Unsupported type.");
  auto context{isolate->GetCurrentContext()};
  auto key{String::NewFromUtf8(isolate, propertyName).ToLocalChecked()};
  if (object->Has(context, key).FromJust()) {
    auto val{object->Get(context, key).ToLocalChecked()};
    if (val->IsUndefined()) {
      return defaultValue;
    }
    using V8Type = V8ValueType<T>;
    if (((*val)->*v8ValueTypeGuard<T>)()) {
      return v8ToCxx(isolate, val.As<V8Type>());
    } else {
      return defaultValue;
    }
  }
  return defaultValue;
}

}  // namespace

#define MAP_TO_STRUCT(v8obj, cxxobj, prop) \
  cxxobj.prop =                            \
      getPropertyFromObject<decltype(cxxobj.prop)>(isolate, v8obj, #prop)

void Method(const FunctionCallbackInfo<Value>& args) {
  auto isolate{args.GetIsolate()};
  auto context{isolate->GetCurrentContext()};

  if (args.Length() < 2) {
    isolate->ThrowException(Exception::TypeError(
        String::NewFromUtf8(isolate, "Wrong number of arguments")
            .ToLocalChecked()));
    return;
  }

  if (!args[0]->IsString() || !args[1]->IsObject()) {
    isolate->ThrowException(Exception::TypeError(
        String::NewFromUtf8(isolate, "Wrong type of arguments")
            .ToLocalChecked()));
    return;
  }

  Config config;

  String::Utf8Value arg0(isolate, args[0]);
  config.executable_path = std::string(*arg0);

  auto arg1{args[1].As<Object>()};
  MAP_TO_STRUCT(arg1, config, input_path);
  MAP_TO_STRUCT(arg1, config, output_path);
  MAP_TO_STRUCT(arg1, config, arguments);
  MAP_TO_STRUCT(arg1, config, environment);
  MAP_TO_STRUCT(arg1, config, log_path);
  MAP_TO_STRUCT(arg1, config, uid);
  MAP_TO_STRUCT(arg1, config, gid);
  MAP_TO_STRUCT(arg1, config, max_cpu_time);
  MAP_TO_STRUCT(arg1, config, max_memory);
  MAP_TO_STRUCT(arg1, config, max_stack);
  MAP_TO_STRUCT(arg1, config, max_process_number);
  MAP_TO_STRUCT(arg1, config, max_output_size);
  printf("%s; %s", config.arguments[0].c_str(), config.arguments[1].c_str());

  args.GetReturnValue().Set(Number::New(isolate, 0));
}

void init(v8::Local<v8::Object> exports, v8::Local<v8::Object> module) {
  NODE_SET_METHOD(module, "exports", Method);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, init)
