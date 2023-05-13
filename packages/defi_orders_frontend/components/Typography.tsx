import { Text } from "@chakra-ui/react";

export const Heading1 = (props) => {
  return <Text fontSize={"2xl"} as={"b"} {...props}></Text>;
};

export const Heading2 = (props) => {
  return <Text fontSize={{ base: "l", sm: "xl" }} as={"b"} {...props}></Text>;
};

export const Heading3 = (props) => {
  return <Text fontSize={{ base: "m", md: "l" }} {...props}></Text>;
};

export const GridLabel = ({ children }) => {
  return <Text>{children}</Text>;
};

export const GridText = ({ children }) => {
  return <Text>{children}</Text>;
};
