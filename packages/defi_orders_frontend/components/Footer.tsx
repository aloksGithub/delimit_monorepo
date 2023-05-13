import { Box, Flex, HStack } from "@chakra-ui/react";
import { AiOutlineCopyrightCircle, AiOutlineTwitter } from "react-icons/ai";
import { BsDiscord, BsGithub } from "react-icons/bs";

export const Footer = () => {
  return (
    <Box position={"absolute"} bottom="0px" width="100%">
      <Flex
        margin={"auto"}
        borderTop={"1px"}
        borderColor="gray.400"
        maxWidth={"1000px"}
        width="80%"
        p={"5"}
        alignItems="center"
        justifyContent={"space-between"}
      >
        <Flex alignItems="center">
          <AiOutlineCopyrightCircle />
          &nbsp;
          {new Date().getFullYear()} Delimit
        </Flex>
        <HStack gap={{ sm: "6", base: "2" }}>
          <Box _hover={{ cursor: "pointer" }}>
            <AiOutlineTwitter color="gray" fontSize={"1.5rem"} />
          </Box>
          <Box _hover={{ cursor: "pointer" }}>
            <BsDiscord color="gray" fontSize={"1.5rem"} />
          </Box>
          <Box _hover={{ cursor: "pointer" }}>
            <BsGithub color="gray" fontSize={"1.5rem"} />
          </Box>
        </HStack>
      </Flex>
    </Box>
  );
};
