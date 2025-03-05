import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { JsonMergeService } from "../../../src/service/JsonMergeService.js";
import { XmlMergeService } from "../../../src/service/XmlMergeService.js";

jest.mock("fast-xml-parser", () => {
  return {
    XMLParser: jest.fn().mockImplementation(() => {
      return {
        parse: (xml) => xml,
      };
    }),
    XMLBuilder: jest.fn().mockImplementation(() => {
      return {
        build: (obj) => obj,
      };
    }),
  };
});

const mockedMergeObjects = jest.fn();
jest.mock("../../../src/service/JsonMergeService.js", () => {
  return {
    JsonMergeService: jest.fn().mockImplementation(() => {
      return {
        mergeObjects: mockedMergeObjects,
      };
    }),
  };
});

describe("MergeDriver", () => {
  let sut: XmlMergeService;

  beforeEach(() => {
    sut = new XmlMergeService();
  });

  describe("tripartXmlMerge", () => {
    it("should merge files successfully when given valid parameters", async () => {
      // Act
      await sut.tripartXmlMerge("AncestorFile", "OurFile", "TheirFile");

      // Assert
      expect(XMLParser).toHaveBeenCalledTimes(1);
      expect(XMLBuilder).toHaveBeenCalledTimes(1);
      expect(JsonMergeService).toHaveBeenCalledTimes(1);
    });

    it("should throw an error when tripartXmlMerge fails", async () => {
      // Arrange
      mockedMergeObjects.mockRejectedValue(
        new Error("Tripart XML merge failed")
      );

      // Act and Assert
      await expect(
        sut.tripartXmlMerge("AncestorFile", "OurFile", "TheirFile")
      ).rejects.toThrowError("Tripart XML merge failed");
    });
  });
});
