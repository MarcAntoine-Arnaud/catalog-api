import { NextFunction, Request, Response } from "express";
import { buildResolvableSelfDescriptionURI } from "../../../libs/self-descriptions";
import { SoftwareResource } from "../../../models";
import { mapSoftwareResource } from "../../../libs/dcat";
import { GlobalPurpose } from "../../../models/GlobalPurpose";
import { Representation } from "../../../models/Representation";

const DEFAULT_QUERY_OPTIONS = {
  page: 0,
  limit: 50,
};

export const createSoftwareResource = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const resource = new SoftwareResource({
      ...req.body,
      providedBy: req.user.id,
    });

    await resource.save();

    return res.status(201).json(resource);
  } catch (err) {
    next(err);
  }
};

/**
 * Gets all software resources declared by one participant
 */
export const getParticipantSoftwareResources = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { limit, page } = req.query;
    const queryOptions: {
      limit: number;
      page: number;
    } = {
      ...DEFAULT_QUERY_OPTIONS,
      limit: parseInt(limit?.toString()) || 0,
      page: parseInt(page?.toString()) || 0,
    };

    const [resources, count] = await Promise.all([
      SoftwareResource.find({
        providedBy: req.user.id,
      })
        .populate([
          { path: "category", model: GlobalPurpose },
          { path: "representation", model: Representation },
        ])
        .limit(queryOptions?.limit)
        .skip(queryOptions?.page * queryOptions?.limit)
        .lean(),
      SoftwareResource.count({ providedBy: req.user.id }),
    ]);

    return res.json({
      data: {
        limit: queryOptions.limit,
        page: queryOptions.page,
        pages:
          count / queryOptions.limit < 1
            ? 1
            : Math.ceil(count / queryOptions.limit),
        count,
        result: resources.map((softwareResource) => ({
          ...softwareResource,
          copyrightOwnedBy: softwareResource.copyrightOwnedBy.map((v) =>
            buildResolvableSelfDescriptionURI("participants", v)
          ),
          providedBy: buildResolvableSelfDescriptionURI(
            "participants",
            softwareResource.providedBy
          ),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getSoftwareResourceById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const softwareResource = await SoftwareResource.findById(req.params.id)
      .populate([{ path: "representation", model: Representation }])
      .lean();

    if (!softwareResource) {
      return res.status(404).json({
        code: 404,
        errorMsg: "Resource not found",
        message: "The software resource could not be found",
      });
    }

    softwareResource.copyrightOwnedBy = softwareResource.copyrightOwnedBy.map(
      (v) => buildResolvableSelfDescriptionURI("participants", v)
    );
    softwareResource.providedBy = buildResolvableSelfDescriptionURI(
      "participants",
      softwareResource.providedBy
    );

    return res.json(softwareResource);
  } catch (err) {
    next(err);
  }
};

export const getDCATSoftwareResourceById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const softwareResource = await SoftwareResource.findById(req.params.id)
      .populate([{ path: "representation", model: Representation }])
      .lean();

    if (!softwareResource) {
      return res.status(404).json({
        code: 404,
        errorMsg: "Resource not found",
        message: "The software resource could not be found",
      });
    }

    softwareResource.copyrightOwnedBy = softwareResource.copyrightOwnedBy.map(
      (v) => buildResolvableSelfDescriptionURI("participants", v)
    );
    softwareResource.providedBy = buildResolvableSelfDescriptionURI(
      "participants",
      softwareResource.providedBy
    );

    return res.json(
      mapSoftwareResource({
        ...softwareResource,
        _id: softwareResource._id.toString(),
      })
    );
  } catch (err) {
    next(err);
  }
};

export const updateSoftwareResource = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const softwareResource = await SoftwareResource.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!softwareResource) {
      return res.status(404).json({
        code: 404,
        errorMsg: "Resource not found",
        message: "The software resource could not be found",
      });
    }

    return res.json(softwareResource);
  } catch (err) {
    next(err);
  }
};

export const deleteSoftwareResource = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const softwareResource = await SoftwareResource.findByIdAndDelete(
      req.params.id
    );

    if (!softwareResource) {
      return res.status(404).json({
        code: 404,
        errorMsg: "Resource not found",
        message: "The software resource could not be found",
      });
    }

    return res.status(204).json(softwareResource);
  } catch (err) {
    next(err);
  }
};
