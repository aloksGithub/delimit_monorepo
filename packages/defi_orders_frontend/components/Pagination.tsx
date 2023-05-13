import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { Box, Text, Flex, Skeleton, SkeletonText, Button, Grid, GridItem, useColorModeValue } from "@chakra-ui/react";
import { useEffect, useState } from "react";

export const Pagination = ({ cards, placeholder }) => {
  const cardsPerPage = 6;
  const numPages = 1 + (cards?.length - (cards?.length % cardsPerPage)) / cardsPerPage;
  const [currentPage, setCurrentPage] = useState(0);
  const cardsToShow = cards?.slice(currentPage * cardsPerPage, (currentPage + 1) * cardsPerPage);
  const [pageNumbersToShow, setNumbersToShow] = useState([]);

  useEffect(() => {
    // window.scrollTo(0, 0)
    const surroundingPages = [];
    if (currentPage - 1 > 0) {
      surroundingPages.push(0);
    }
    if (currentPage - 2 > 0) {
      surroundingPages.push(currentPage - 2);
    }
    if (currentPage - 1 >= 0) {
      surroundingPages.push(currentPage - 1);
    }
    surroundingPages.push(currentPage);
    if (currentPage + 1 < numPages - 1) {
      surroundingPages.push(currentPage + 1);
    }
    if (currentPage + 2 < numPages - 1) {
      surroundingPages.push(currentPage + 2);
    }
    if (!surroundingPages.includes(numPages - 1) && numPages) {
      surroundingPages.push(numPages - 1);
    }
    setNumbersToShow(surroundingPages);
  }, [cards, currentPage]);

  return (
    <Box>
      <Grid
        gridTemplateColumns={{
          base: `1fr`,
          md: `repeat(min(2, ${cardsToShow?.length || 2}), 1fr)`,
          xl: `repeat(min(3, ${cardsToShow?.length || 3}), 1fr)`,
        }}
        gap="10"
      >
        {cardsToShow && cardsToShow.length > 0 ? (
          cardsToShow
        ) : !cardsToShow ? (
          Array.from(Array(6).keys()).map((i) => {
            return (
              <Flex key={`paginationSkeleton_${i}`} width={"100%"} justifyContent="center">
                <Box
                  py={6}
                  px={"10"}
                  m={"4"}
                  boxShadow="lg"
                  bgColor={useColorModeValue("white", "gray.800")}
                  width={"300px"}
                  height={"280"}
                >
                  <Skeleton width={"80%"} height="40px" color="white" mb={"8"} />
                  <SkeletonText mt="4" noOfLines={6} spacing="4" />
                </Box>
              </Flex>
            );
            // @ts-ignore
          })
        ) : (
          <GridItem margin={"auto"} width={"70%"} colSpan={24}>
            {placeholder}
          </GridItem>
        )}
      </Grid>
      {numPages && numPages > 1 ? (
        <Flex mt={"4"} justifyContent={"center"}>
          <Button
            backgroundColor={"blackAlpha.200"}
            padding={"0"}
            size={"sm"}
            onClick={() => setCurrentPage(currentPage === 0 ? 0 : currentPage - 1)}
          >
            <ChevronLeftIcon fontSize={"2xl"}></ChevronLeftIcon>
          </Button>
          {pageNumbersToShow?.map((page, index) => {
            return (
              <Flex marginInline={"1"}>
                {index > 0 && pageNumbersToShow[index - 1] < page - 1 ? <Text mr={"1"}>...</Text> : <></>}
                <Button
                  colorScheme={page === currentPage ? "blue" : undefined}
                  padding={"0"}
                  size={"sm"}
                  onClick={() => setCurrentPage(page)}
                >
                  {page + 1}
                </Button>
              </Flex>
            );
          })}
          <Button
            backgroundColor={"blackAlpha.200"}
            padding={"0"}
            size={"sm"}
            onClick={() => setCurrentPage(currentPage === numPages - 1 ? numPages - 1 : currentPage + 1)}
          >
            <ChevronRightIcon fontSize={"2xl"}></ChevronRightIcon>
          </Button>
        </Flex>
      ) : (
        <></>
      )}
    </Box>
  );
};
