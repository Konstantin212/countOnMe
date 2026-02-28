// Mock for react-native in jsdom test environment
// Prevents Vite from resolving the real package (which contains Flow syntax)
const React = require("react");

const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) =>
    Array.isArray(style) ? Object.assign({}, ...style) : style || {},
  absoluteFillObject: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  absoluteFill: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  hairlineWidth: 1,
};

function createMockComponent(name) {
  const component = function (props) {
    const { testID, children, ...rest } = props || {};
    return React.createElement(
      name.toLowerCase(),
      { ...rest, "data-testid": testID },
      children,
    );
  };
  component.displayName = name;
  return component;
}

const View = createMockComponent("View");
const Text = createMockComponent("Text");
const Image = createMockComponent("Image");
const ScrollView = createMockComponent("ScrollView");
const TextInput = createMockComponent("TextInput");

// TouchableOpacity / Pressable: map onPress → onClick so fireEvent.click works
function createPressableMockComponent(name) {
  const component = function (props) {
    const { testID, children, onPress, style, ...rest } = props || {};
    // style may be a function (pressed state) — resolve to plain object for jsdom
    const resolvedStyle = typeof style === "function" ? style({ pressed: false }) : style;
    return React.createElement(
      name.toLowerCase(),
      { ...rest, style: resolvedStyle, "data-testid": testID, onClick: onPress },
      children,
    );
  };
  component.displayName = name;
  return component;
}

const TouchableOpacity = createPressableMockComponent("TouchableOpacity");
const Pressable = createPressableMockComponent("Pressable");
const FlatList = createMockComponent("FlatList");
const ActivityIndicator = createMockComponent("ActivityIndicator");
const SafeAreaView = createMockComponent("SafeAreaView");

const Platform = {
  OS: "web",
  select: (obj) => obj.web || obj.default,
  Version: 0,
};

const Dimensions = {
  get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
  addEventListener: () => ({ remove: () => {} }),
};

const Appearance = {
  getColorScheme: () => "light",
  addChangeListener: () => ({ remove: () => {} }),
};

const useColorScheme = () => "light";

const Alert = {
  alert: () => {},
};

const Linking = {
  openURL: () => Promise.resolve(),
  canOpenURL: () => Promise.resolve(true),
  addEventListener: () => ({ remove: () => {} }),
};

const Animated = {
  Value: class {
    constructor(val) {
      this._value = val;
    }
    setValue() {}
    interpolate() {
      return this;
    }
  },
  View: createMockComponent("Animated.View"),
  Text: createMockComponent("Animated.Text"),
  Image: createMockComponent("Animated.Image"),
  timing: () => ({ start: (cb) => cb && cb() }),
  spring: () => ({ start: (cb) => cb && cb() }),
  parallel: () => ({ start: (cb) => cb && cb() }),
  sequence: () => ({ start: (cb) => cb && cb() }),
  event: () => () => {},
};

module.exports = {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Dimensions,
  Appearance,
  useColorScheme,
  Alert,
  Linking,
  Animated,
};
