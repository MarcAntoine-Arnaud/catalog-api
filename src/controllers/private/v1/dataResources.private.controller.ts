import { NextFunction, Request, Response } from "express";
import { buildResolvableSelfDescriptionURI } from "../../../libs/self-descriptions";
import { DataResource } from "../../../models";
import { GlobalDataType } from "../../../models";
import { Representation } from "../../../models/Representation";

const DEFAULT_QUERY_OPTIONS = {
  page: 0,
  limit: 50,
};

export const createDataResource = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dataResource = new DataResource({
      ...req.body,
      producedBy: req.user.id,
    });

    await dataResource.save();

    return res.status(201).json(dataResource);
  } catch (err) {
    next(err);
  }
};

/**
 * Gets all data resources declared by one participant
 */
export const getParticipantDataResources = async (
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
      DataResource.find({
        producedBy: req.user.id,
      })
        .populate([
          {
            path: "category",
            match: { category: { $ne: "" } },
            model: GlobalDataType,
          },
          {
            path: "representation",
            model: Representation,
          },
        ])
        .limit(queryOptions?.limit)
        .skip(queryOptions?.page * queryOptions?.limit)
        .lean(),
      DataResource.count({ producedBy: req.user.id }),
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
        result: resources.map((dataResource) => ({
          ...dataResource,
          copyrightOwnedBy: dataResource.copyrightOwnedBy.map((v) =>
            buildResolvableSelfDescriptionURI("participants", v)
          ),
          producedBy: buildResolvableSelfDescriptionURI(
            "participants",
            dataResource.producedBy
          ),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateDataResource = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dataResource = await DataResource.findByIdAndUpdate(
      req.params.id,
      { ...req.body, producedBy: req.user.id },
      { new: true, runValidators: true }
    );
    if (!dataResource) {
      return res.status(404).json({
        code: 404,
        errorMsg: "Resource not found",
        message: "The data resource could not be found",
      });
    }

    return res.json(dataResource);
  } catch (err) {
    next(err);
  }
};

export const deleteDataResource = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dataResource = await DataResource.findByIdAndDelete(req.params.id);

    if (!dataResource) {
      return res.status(404).json({
        code: 404,
        errorMsg: "Resource not found",
        message: "The data resource could not be found",
      });
    }

    return res.status(204).json(dataResource);
  } catch (err) {
    next(err);
  }
};
