// Mock for react-native-svg in jsdom test environment
// Prevents Vite from resolving the real module (which contains Flow syntax)
const React = require("react");

function createMockElement(tag) {
  return function MockElement(props) {
    const { testID, children, ...rest } = props || {};
    return React.createElement(
      tag,
      { ...rest, "data-testid": testID },
      children,
    );
  };
}

const Svg = createMockElement("svg");

module.exports = {
  __esModule: true,
  default: Svg,
  Svg: Svg,
  Circle: createMockElement("circle"),
  Rect: createMockElement("rect"),
  Path: createMockElement("path"),
  G: createMockElement("g"),
  Line: createMockElement("line"),
  Text: createMockElement("text"),
  Defs: createMockElement("defs"),
  LinearGradient: createMockElement("linearGradient"),
  Stop: createMockElement("stop"),
  ClipPath: createMockElement("clipPath"),
};
