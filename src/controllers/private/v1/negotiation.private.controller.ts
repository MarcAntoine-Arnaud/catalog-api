import { NextFunction, Request, Response } from "express";
import { ExchangeConfiguration } from "../../../models";
import {
  exchangeConfigurationPopulation,
  serviceOfferingPopulation,
} from "../../../utils/schemaPopulation";
import { getDocumentId } from "../../../utils/mongooseDocumentHelpers";
import { generateBilateralContract } from "../../../libs/contract";
import { IParticipant } from "../../../types/participant";
import { IServiceOffering } from "../../../types/serviceoffering";
import { batchInjectPoliciesInBilateralContract } from "../../../libs/contract/policyInjector";
import { signBilateralContract } from "../../../libs/contract/signatures";

/**
 * Returns all exchange configurations for a participant
 */
export const getMyExchangeConfigurations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ecs = await ExchangeConfiguration.find({
      $or: [{ provider: req.user.id }, { consumer: req.user.id }],
    })
      .populate(exchangeConfigurationPopulation)
      .lean();

    return res.json(ecs);
  } catch (err) {
    next(err);
  }
};

/**
 * Returns exchange configuration by ID
 */
export const getExchangeConfigurationById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const exchangeConf = await ExchangeConfiguration.findById(id)
      .populate(exchangeConfigurationPopulation)
      .lean();

    if (!exchangeConf)
      return res.status(404).json({
        code: 404,
        errorMsg: "Resource not found",
        message: "Exchange Configuration not found",
      });

    return res.json(exchangeConf);
  } catch (err) {
    next(err);
  }
};

/**
 * Creates a service offering access request
 */
export const createServiceOfferingAccessRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      provider,
      consumer,
      providerServiceOffering,
      consumerServiceOffering,
    } = req.body;

    const existing = await ExchangeConfiguration.findOne({
      consumer,
      provider,
      providerServiceOffering,
      consumerServiceOffering,
    }).lean();

    if (existing) {
      return res.status(409).json({
        code: 409,
        errorMsg: "conflicting resource",
        message:
          "An access request for this configuration already exists with id: " +
          existing._id,
      });
    }

    const exchangeConfiguration = new ExchangeConfiguration();
    const result = await exchangeConfiguration.request({
      provider,
      consumer,
      providerServiceOffering,
      consumerServiceOffering,
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Authorizes a service offering access request
 */
export const authorizeExchangeConfiguration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { policy } = req.body;

    const exchangeConf = await ExchangeConfiguration.findById(id);

    if (!exchangeConf) {
      return res.status(404).json({
        code: 404,
        errorMsg: "Resource not found",
        message: "Exchange Configuration could not be found",
      });
    }

    if (exchangeConf.provider.toString() !== req.user.id.toString()) {
      return res.status(400).json({
        code: 400,
        errorMsg: "Resource error",
        message: "Exchange Configuration could not be authorized",
      });
    }

    if (exchangeConf.negotiationStatus === "Authorized") {
      return res.status(400).json({
        code: 400,
        errorMsg: "Invalid operation",
        message: "Exchange configuration has already been authorized",
      });
    }

    if (getDocumentId(exchangeConf.provider) !== req.user.id) {
      return res.status(401).json({ error: "Unauthorized operation" });
    }

    try {
      const contract = await generateBilateralContract({
        dataConsumer: exchangeConf.consumer,
        dataProvider: exchangeConf.provider,
        serviceOffering: exchangeConf.providerServiceOffering,
      });

      if (!contract)
        throw new Error("Contract was not returned by Contract Service");

      exchangeConf.contract = contract._id;
    } catch (err) {
      return res
        .status(409)
        .json({ error: "Failed to generate contract: " + err.message });
    }

    exchangeConf.providerPolicies = policy;
    exchangeConf.negotiationStatus = "Authorized";
    exchangeConf.latestNegotiator = req.user.id;

    await exchangeConf.save();
    return res.status(200).json(exchangeConf);
  } catch (err) {
    next(err);
  }
};

/**
 * Negotiates policies on the access of resources
 * in the exchange configuration
 */
export const negotiateExchangeConfigurationPolicy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { policy } = req.body;

    const exchangeConf = await ExchangeConfiguration.findById(id);

    if (!exchangeConf) {
      return res.status(404).json({
        code: 404,
        errorMsg: "Resource not found",
        message: "Exchange Configuration could not be found",
      });
    }

    exchangeConf.providerPolicies = policy;
    exchangeConf.negotiationStatus = "Negotiation";
    exchangeConf.latestNegotiator = req.user.id;

    await exchangeConf.save();
    return res.json(exchangeConf);
  } catch (err) {
    next(err);
  }
};

/**
 * Accepts the negotiation and proceeds to pass the
 * negotiation exchange configuration as pending signature
 */
export const acceptNegotiation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const exchangeConf = await ExchangeConfiguration.findById(id);

    if (!exchangeConf) {
      return res.status(404).json({
        code: 404,
        errorMsg: "Resource not found",
        message: "Exchange Configuration could not be found",
      });
    }

    if (exchangeConf.negotiationStatus === "SignatureReady") {
      return res.status(400).json({
        code: 400,
        errorMsg: "Invalid operation",
        message:
          "Exchange configuration has already been validated and is pending signatures",
      });
    }

    exchangeConf.negotiationStatus = "SignatureReady";

    await exchangeConf.save();

    return res.json(exchangeConf);
  } catch (err) {
    next(err);
  }
};

/**
 * Called by a participant to sign the service offering access request
 * and thus the bilateral contract associated
 */
export const signExchangeConfiguration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { signature } = req.body;

    const exchangeConf = await ExchangeConfiguration.findById(id).populate<{
      provider: IParticipant;
      consumer: IParticipant;
      providerServiceOffering: IServiceOffering;
      consumerServiceOffering: IServiceOffering;
    }>([
      {
        path: "provider",
        model: "Participant",
      },
      {
        path: "consumer",
        model: "Participant",
      },
      {
        path: "providerServiceOffering",
        model: "ServiceOffering",
        populate: serviceOfferingPopulation,
      },
      {
        path: "consumerServiceOffering",
        model: "ServiceOffering",
        populate: serviceOfferingPopulation,
      },
    ]);

    if (!exchangeConf) {
      return res.status(404).json({
        code: 404,
        errorMsg: "Resource not found",
        message: "Exchange Configuration could not be found",
      });
    }

    if (exchangeConf.negotiationStatus !== "SignatureReady") {
      return res.status(400).json({
        code: 400,
        errorMsg: "Invalid operation",
        message: "Exchange configuration is not ready for signature",
      });
    }

    const signingParty =
      req.user.id === getDocumentId(exchangeConf.provider)
        ? "provider"
        : "consumer";

    exchangeConf.signatures[signingParty] = signature;

    try {
      // If both have applied signatures, we can inject the policies
      // this avoids injecting the same policies multiple times
      if (
        exchangeConf.signatures.consumer &&
        exchangeConf.signatures.provider
      ) {
        await batchInjectPoliciesInBilateralContract({
          contractId: exchangeConf.contract,
          rules: exchangeConf.providerPolicies,
        });
      }
    } catch (err) {
      return res.status(409).json({
        error: "Failed to inject policies in bilateral contract",
      });
    }

    let contract = null;

    try {
      contract = await signBilateralContract({
        contractId: exchangeConf.contract,
        signature: {
          did: req.user.id,
          party: req.user.id,
          value: signature,
        },
      });
      if (contract.status === "signed") {
        exchangeConf.negotiationStatus = "Signed";
      }
    } catch (err) {
      return res.status(409).json({ error: "Failed to sign contract" });
    }

    await exchangeConf.save();

    // The client can handle UI to show depending on the contract status
    return res.json({
      code: 200,
      data: { exchangeConfiguration: exchangeConf, contract },
      message: "Successfully updated exchange configuration",
    });
  } catch (err) {
    next(err);
  }
};
