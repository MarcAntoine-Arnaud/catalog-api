import { NextFunction, Request, Response } from "express";
import { issueJwt } from "../../../libs/jwt/jwt";
import { Router } from "express";
import { OrganizationAdmin } from "../../../models";
import { Participant } from "../../../models";
import { makeId } from "../../../utils/idGenerator";

const r: Router = Router();

/**
 * Creates an administrator and the corresponding Participant
 */
r.post("/signup", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, participantName, password } = req.body;

    const [admin, participant] = await Promise.all([
      OrganizationAdmin.findOne({ email }),
      Participant.findOne({ legalName: participantName }),
    ]);
    if (admin) return res.status(409).json({ error: "Existing email" });
    if (participant)
      return res.status(409).json({ error: "Existing participant" });

    const newParticipant = new Participant({
      legalName: participantName,
      serviceKey: makeId(),
      serviceSecretKey: makeId(),
    });
    const newAdmin = new OrganizationAdmin({
      ...req.body,
      organization: newParticipant.id,
      roles: ["admin"],
      permissions: ["all"],
    });

    newAdmin.password = newAdmin.hashPassword(password);

    await Promise.all([newAdmin.save(), newParticipant.save()]);

    return res.status(201).json({
      admin: { ...newAdmin.toObject(), password: undefined },
      participant: { ...newParticipant.toObject() },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Logs the participant in and generates a JWT
 * for authentication in following requests
 */
r.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const admin = await OrganizationAdmin.findOne({ email });

    if (!admin || !admin.isPasswordValid(password)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const participant = await Participant.findById(admin.organization);
    if (!participant) {
      return res.status(404).json({
        error: "No Participant organization associated to your account",
      });
    }

    const token = issueJwt(participant);
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

export default r;
