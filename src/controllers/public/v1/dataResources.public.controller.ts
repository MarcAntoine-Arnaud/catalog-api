import { NextFunction, Request, Response } from "express";
import { DataResource } from "../../../models";
import { buildResolvableSelfDescriptionURI } from "../../../libs/self-descriptions";
import { mapCatalog, mapDataResource } from "../../../libs/dcat";
import { ResourceTypes } from "../../../libs/dcat/types";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { GlobalDataType } from "../../../models";
import { Representation } from "../../../models/Representation";

const DEFAULT_QUERY_OPTIONS = {
  page: 0,
  limit: 50,
};

export const getDataResources = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { limit, page, producedBy } = req.query;
    const queryOptions: {
      limit: number;
      page: number;
      producedBy?: string;
    } = {
      ...DEFAULT_QUERY_OPTIONS,
      limit: parseInt(limit?.toString()) || 0,
      page: parseInt(page?.toString()) || 0,
      producedBy: producedBy?.toString() || "",
    };

    let countQuery = DataResource.count();
    let query = DataResource.find();

    if (queryOptions.producedBy) {
      countQuery = query.count({ producedBy: queryOptions.producedBy });
      query = query.where("producedBy").equals(queryOptions.producedBy);
    }

    const [resources, count] = await Promise.all([
      query
        .populate([
          { path: "category", model: GlobalDataType },
          { path: "representation", model: Representation },
        ])
        .limit(queryOptions?.limit)
        .skip(queryOptions?.page * queryOptions?.limit)
        .lean(),
      countQuery,
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

export const getDataResourceById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dataResource = await DataResource.findById(req.params.id)
      .populate([{ path: "representation", model: Representation }])
      .lean();
    if (!dataResource) {
      return res.json({
        req,
        res,
        code: 404,
        errorMsg: "Resource not found",
        message: "The data resource could not be found",
      });
    }
    dataResource.copyrightOwnedBy = dataResource.copyrightOwnedBy.map((v) =>
      buildResolvableSelfDescriptionURI("participants", v)
    );
    dataResource.producedBy = buildResolvableSelfDescriptionURI(
      "participants",
      dataResource.producedBy
    );
    return res.json(dataResource);
  } catch (err) {
    next(err);
  }
};

export const getDCATDataResourceById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dataResource = await DataResource.findById(req.params.id).lean();
    if (!dataResource) {
      return res.json({
        req,
        res,
        code: 404,
        errorMsg: "Resource not found",
        message: "The data resource could not be found",
      });
    }
    dataResource.copyrightOwnedBy = dataResource.copyrightOwnedBy.map((v) =>
      buildResolvableSelfDescriptionURI("participants", v)
    );
    dataResource.producedBy = buildResolvableSelfDescriptionURI(
      "participants",
      dataResource.producedBy
    );
    return res.json(
      mapDataResource({ ...dataResource, _id: dataResource._id.toString() })
    );
  } catch (err) {
    next(err);
  }
};

export const getDCATDataResources = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { limit, page, producedBy } = req.query;
    const queryOptions: {
      limit: number;
      page: number;
      producedBy?: string;
    } = {
      ...DEFAULT_QUERY_OPTIONS,
      limit: parseInt(limit?.toString()) || 0,
      page: parseInt(page?.toString()) || 0,
      producedBy: producedBy?.toString() || "",
    };

    let countQuery = DataResource.count();
    let query = DataResource.find();

    if (queryOptions.producedBy) {
      countQuery = query.count({ producedBy: queryOptions.producedBy });
      query = query.where("producedBy").equals(queryOptions.producedBy);
    }

    const [resources, count] = await Promise.all([
      query
        .populate([
          { path: "category", model: GlobalDataType, select: "-_id -__v" },
        ])
        .limit(queryOptions?.limit)
        .skip(queryOptions?.page * queryOptions?.limit)
        .lean(),
      countQuery,
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
        result: mapCatalog(
          resources.map((dataResource) => ({
            ...dataResource,
            copyrightOwnedBy: dataResource.copyrightOwnedBy.map((v) =>
              buildResolvableSelfDescriptionURI("participants", v)
            ),
            producedBy: buildResolvableSelfDescriptionURI(
              "participants",
              dataResource.producedBy
            ),
          })),
          {
            title: "DataResource",
            description: "DataResource DCAT Catalog",
          },
          ResourceTypes.DataResource
        ),
      },
    });
  } catch (err) {
    next(err);
  }
};
