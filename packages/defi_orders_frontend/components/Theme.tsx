import { extendTheme, ThemeConfig, useColorModeValue } from "@chakra-ui/react";

const config: ThemeConfig = {
  initialColorMode: "dark",
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
});

export const level0: [string, string] = ["white", "gray.900"];
export const level1: [string, string] = ["gray.100", "gray.800"];
export const level2: [string, string] = ["gray.200", "gray.700"];
export const level3: [string, string] = ["gray.300", "gray.600"];

export default theme;
