import { Center, IconButton, useColorModeValue } from "@chakra-ui/react";
import { AiOutlineReload } from "react-icons/ai";
import { keyframes } from "@chakra-ui/react";

export const Reload = ({ onReload, loading }) => {
  const spin = keyframes`
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  `;

  const animation = loading ? `${spin} infinite 1s linear` : undefined;

  const reload = () => {
    if (loading) return;
    onReload();
  };

  return (
    <IconButton
      onClick={reload}
      aria-label="reload"
      backgroundColor={useColorModeValue("gray.100", "gray.500")}
      icon={
        <Center animation={animation}>
          <AiOutlineReload style={{}} fontSize={"1.2rem"}></AiOutlineReload>
        </Center>
      }
    ></IconButton>
  );
};
