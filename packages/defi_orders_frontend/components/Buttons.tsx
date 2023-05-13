import { Button, useColorModeValue } from "@chakra-ui/react";

export const PrimaryButton = (props) => {
  const { size = "medium" } = props;
  let buttonProps: any;
  if (size == "medium") {
    buttonProps = { ...props, size: { base: "sm", md: "md" } };
  } else if (size == "large") {
    buttonProps = { ...props, size: { base: "md", md: "lg" } };
  }
  return (
    <Button
      color="white"
      bgColor={useColorModeValue("blue.500", "blue.600")}
      _hover={{ bgColor: useColorModeValue("blue.600", "blue.700") }}
      _focus={{ bgColor: useColorModeValue("blue.700", "blue.800") }}
      rounded={"full"}
      {...buttonProps}
    ></Button>
  );
};

export const SecondaryButton = (props) => {
  const { size = "medium" } = props;
  let buttonProps: any;
  if (size == "medium") {
    buttonProps = { ...props, size: { base: "sm", md: "md" } };
  } else if (size == "large") {
    buttonProps = { ...props, size: { base: "md", md: "lg" } };
  }
  return <Button rounded={"full"} {...buttonProps}></Button>;
};

export const DangerButton = (props) => {
  const { size = "medium" } = props;
  let buttonProps: any;
  if (size == "medium") {
    buttonProps = { ...props, size: { base: "sm", md: "md" } };
  } else if (size == "large") {
    buttonProps = { ...props, size: { base: "md", md: "lg" } };
  }
  return (
    <Button
      color="white"
      bgColor={useColorModeValue("red.500", "red.600")}
      _hover={{ bgColor: useColorModeValue("red.600", "red.700") }}
      _focus={{ bgColor: useColorModeValue("red.700", "red.800") }}
      rounded={"full"}
      {...buttonProps}
    ></Button>
  );
};

export const FancyButton = (props) => {
  return (
    <Button
      paddingBlock={"5"}
      bgGradient="linear(to-l, #822bd9, #3db0f2)"
      maxWidth={"300px"}
      justifyContent={"center"}
      alignItems={"center"}
      borderRadius={"2xl"}
      boxShadow={"dark-lg"}
      _active={{ bgGradient: "linear(to-l, #531c8a, #308bbf)" }}
      _hover={{ cursor: "pointer", bgGradient: "linear(to-l, #6823ad, #3db0f2)" }}
      {...props}
    ></Button>
  );
};
