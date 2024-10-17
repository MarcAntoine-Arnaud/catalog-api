import { NextFunction, Request, Response } from "express";
import { DataResource, SoftwareResource } from "../../../models";
import { Representation } from "../../../models/Representation";
export const createRepresentation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let resource = await DataResource.findById(req.body.resourceID).lean();

    if (!resource) {
      resource = await SoftwareResource.findById(req.body.resourceID).lean();
    }

    if (resource.containsPII) {
      const match = req.body.url.match(
        /^(https?|http?):\/\/[^\s/$.?#].[^\s]*\{([^{}]+)\}[^\s]*$/
      );
      if (!match) {
        return res.status(400).json({
          code: 400,
          errorMsg: "Wrong URL format",
          message: "The url must contain a params between brackets",
        });
      }
    }

    const representation = new Representation({
      ...req.body,
    });

    let updatedResource = await DataResource.findByIdAndUpdate(
      req.body.resourceID,
      {
        representation: representation._id,
      }
    );

    console.log("resource", updatedResource);

    if (!updatedResource) {
      updatedResource = await SoftwareResource.findByIdAndUpdate(
        req.body.resourceID,
        {
          representation: representation._id,
        }
      );
    }

    await Promise.all([representation.save(), updatedResource.save()]);

    return res.status(201).json(representation);
  } catch (err) {
    next(err);
  }
};

export const getRepresentationById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const representation = await Representation.findById(req.params.id).lean();
    if (!representation) {
      return res.status(404).json({
        code: 404,
        errorMsg: "Representation not found",
        message: "The data Representation could not be found",
      });
    }
    return res.status(200).json(representation);
  } catch (err) {
    next(err);
  }
};

export const updateRepresentation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dataRep = await Representation.findById(req.params.id).lean();
    const dataResource = await DataResource.findById(dataRep.resourceID).lean();

    if (dataResource.containsPII) {
      const match = req.body.url.match(
        /^(https?|http?):\/\/[^\s/$.?#].[^\s]*\{([^{}]+)\}[^\s]*$/
      );
      if (!match) {
        return res.status(400).json({
          code: 400,
          errorMsg: "Wrong URL format",
          message: "The url must contain a params between brackets",
        });
      }
    }
    const representation = await Representation.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );
    if (!representation) {
      return res.status(404).json({
        code: 404,
        errorMsg: "Representation not found",
        message: "The data Representation could not be found",
      });
    }

    return res.status(200).json(representation);
  } catch (err) {
    next(err);
  }
};

export const deleteRepresentation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const representation = await Representation.findByIdAndDelete(
      req.params.id
    );

    if (!representation) {
      return res.status(404).json({
        code: 404,
        errorMsg: "Representation not found",
        message: "The data Representation could not be found",
      });
    }

    return res.status(204).json(representation);
  } catch (err) {
    next(err);
  }
};
